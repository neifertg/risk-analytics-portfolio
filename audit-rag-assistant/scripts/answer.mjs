import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSecret } from "./secrets.mjs";
import { retrieve, MIN_RETRIEVAL_SCORE } from "./search.mjs";
import { estimateCostUsd, formatUsageLine } from "./cost.mjs";
import { projectRoot } from "./lib.mjs";

const MODEL = "claude-haiku-4-5-20251001";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 1024;

const LOG_PATH = path.join(projectRoot, "logs", "queries.jsonl");

export function buildSystemPrompt() {
  return [
    "You are an internal-audit assistant answering questions using only the",
    "numbered excerpts below, pulled from a synthetic audit-procedures corpus.",
    "Rules:",
    "- Answer only from the excerpts. Do not use outside knowledge.",
    "- Cite every claim inline with the excerpt number(s) it came from, like [1] or [2][3].",
    "- If the excerpts don't contain enough to answer, say so plainly instead of guessing.",
    "- If excerpts appear to describe two different procedures, say so explicitly",
    "  rather than silently merging them.",
  ].join("\n");
}

export function buildContextBlock(results) {
  return results
    .map(({ chunk }, i) => `[${i + 1}] (${chunk.type}) ${chunk.title} — ${chunk.heading ?? "Summary"}\n${chunk.text}`)
    .join("\n\n");
}

export async function callAnthropic(system, question, context) {
  const apiKey = await loadSecret("anthropic.api_key");
  const userMessage = context ? `Excerpts:\n\n${context}\n\nQuestion: ${question}` : question;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API request failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  const text = json.content.map((block) => block.text ?? "").join("");
  return { text, usage: { inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens } };
}

function logQuery(entry) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n");
}

// Core answer path, used by both the CLI and app.py (via --json). Returns
// { answer, sources, usage, guardrailTriggered } and always logs.
export async function answerQuestion(question) {
  const { results, usage: retrievalUsage } = await retrieve(question);
  const topScore = results[0]?.score ?? 0;

  // Phase 5 guardrail: below MIN_RETRIEVAL_SCORE, refuse before spending a
  // generation call at all — a real gate, not just the system prompt's
  // "say so if you don't know" instruction (which stays as a second layer
  // for in-corpus-but-still-unclear questions).
  if (results.length === 0 || topScore < MIN_RETRIEVAL_SCORE) {
    const usage = { embeddingTokens: retrievalUsage.embeddingTokens, inputTokens: 0, outputTokens: 0 };
    const answer =
      "This question doesn't appear to be covered by the audit-procedures corpus this assistant is " +
      "grounded in, so I'm not going to guess. Try a question about the specific audit procedures in " +
      "this demo (SOX walkthroughs, control testing, sampling methodology, etc.).";
    logQuery({ question, guardrailTriggered: true, topScore, retrievedChunks: [], answer, usage });
    return {
      answer,
      sources: [],
      retrievedNoteIds: [],
      usage: { ...usage, estimatedCostUsd: estimateCostUsd(usage) },
      guardrailTriggered: true,
    };
  }

  const context = buildContextBlock(results);
  const { text, usage: genUsage } = await callAnthropic(buildSystemPrompt(), question, context);
  const sources = results.map(({ chunk }) => ({ title: chunk.title, heading: chunk.heading ?? "Summary" }));
  const usage = {
    embeddingTokens: retrievalUsage.embeddingTokens,
    inputTokens: genUsage.inputTokens,
    outputTokens: genUsage.outputTokens,
  };

  logQuery({
    question,
    guardrailTriggered: false,
    topScore,
    retrievedChunks: results.map(({ chunk, score }) => ({ noteId: chunk.noteId, title: chunk.title, heading: chunk.heading, score })),
    answer: text.trim(),
    usage,
  });

  return {
    answer: text.trim(),
    sources,
    // Aligned index-for-index with `sources` (and with the [n] citation
    // markers the model writes, since buildContextBlock numbers excerpts
    // in this same order) — eval.mjs uses this to check retrieval
    // relevance and map citations back to notes without a second,
    // separately-billed retrieve() call per question.
    retrievedNoteIds: results.map(({ chunk }) => chunk.noteId),
    usage: { ...usage, estimatedCostUsd: estimateCostUsd(usage) },
    guardrailTriggered: false,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const question = args.filter((arg) => arg !== "--json").join(" ").trim();
  if (!question) {
    console.error('answer: usage: npm run ask -- "your question" [--json]');
    process.exit(1);
  }

  const result = await answerQuestion(question);

  if (asJson) {
    console.log(JSON.stringify(result));
    return;
  }

  console.log(result.answer);
  if (result.sources.length > 0) {
    console.log("\nSources:");
    result.sources.forEach((source, i) => {
      console.log(`  [${i + 1}] ${source.title} — ${source.heading}`);
    });
  }
  console.log(`\n${formatUsageLine(result.usage)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`answer: ${err.message}`);
    process.exit(1);
  });
}
