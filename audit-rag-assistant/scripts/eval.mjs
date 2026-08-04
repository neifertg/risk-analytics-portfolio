import fs from "node:fs";
import path from "node:path";
import { projectRoot } from "./lib.mjs";
import { answerQuestion, callAnthropic } from "./answer.mjs";
import { formatUsageLine } from "./cost.mjs";

const questionsPath = path.join(projectRoot, "evals", "questions.json");

const UNGROUNDED_SYSTEM_PROMPT = [
  "You are a helpful assistant. Answer the question from your own knowledge.",
  "You have no access to any external documents — do not claim to be quoting",
  "or citing a source.",
].join("\n");

// Any one of expectedKeywords matching is a pass, not all of them.
function keywordsMatch(text, keywords) {
  if (!keywords || keywords.length === 0) return true;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// Retrieval-relevance check: did the doc(s) the question is really about
// make it into the context at all.
function checkRetrieval(retrievedNoteIds, testCase) {
  const noteIds = new Set(retrievedNoteIds);
  const missing = (testCase.expectedNoteIds ?? []).filter((id) => !noteIds.has(id));
  return { pass: missing.length === 0, missing };
}

// Phase 5 guardrail check: did the MIN_RETRIEVAL_SCORE gate fire exactly
// when expected — both directions matter. A guardrail that never fires on
// a genuinely out-of-corpus question is useless; one that fires on
// legitimate in-corpus questions is its own bug (false-positive refusal).
function checkGuardrail(guardrailTriggered, testCase) {
  const expected = testCase.expectGuardrail ?? false;
  return { pass: guardrailTriggered === expected, expected, actual: guardrailTriggered };
}

// Citation flag (advisory, not pass/fail) — ported from Seth_Wiki's
// eval.mjs. See that file's comment for why this can't be a hard
// pass/fail: a note can be cited correctly to *contrast* it from the
// right answer, which looks identical to a citation-presence check as
// silently conflating the two.
function checkCitations(answer, retrievedNoteIds, testCase) {
  const citedIndexes = new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const citedNoteIds = new Set([...citedIndexes].map((n) => retrievedNoteIds[n - 1]).filter(Boolean));
  const flagged = (testCase.mustNotCite ?? []).filter((id) => citedNoteIds.has(id));
  return { flagged };
}

async function runCase(testCase) {
  const graded = await answerQuestion(testCase.question);
  const ungrounded = await callAnthropic(UNGROUNDED_SYSTEM_PROMPT, testCase.question, null);

  const retrievalCheck = checkRetrieval(graded.retrievedNoteIds, testCase);
  const guardrailCheck = checkGuardrail(graded.guardrailTriggered, testCase);
  const citationCheck = checkCitations(graded.answer, graded.retrievedNoteIds, testCase);
  const keywordCheck = keywordsMatch(graded.answer, testCase.expectedKeywords);

  const usage = {
    embeddingTokens: graded.usage.embeddingTokens,
    inputTokens: graded.usage.inputTokens + ungrounded.usage.inputTokens,
    outputTokens: graded.usage.outputTokens + ungrounded.usage.outputTokens,
  };

  return {
    testCase,
    retrievalCheck,
    guardrailCheck,
    citationCheck,
    keywordCheck,
    groundedAnswer: graded.answer,
    ungroundedAnswer: ungrounded.text,
    usage,
  };
}

function printCase({ testCase, retrievalCheck, guardrailCheck, citationCheck, keywordCheck, groundedAnswer, ungroundedAnswer, usage }) {
  const pass = retrievalCheck.pass && guardrailCheck.pass && keywordCheck;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`[${pass ? "PASS" : "FAIL"}] ${testCase.id} — ${testCase.question}`);
  if (!retrievalCheck.pass) {
    console.log(`  retrieval: missing expected note(s): ${retrievalCheck.missing.join(", ")}`);
  }
  if (!guardrailCheck.pass) {
    console.log(`  guardrail: expected ${guardrailCheck.expected}, got ${guardrailCheck.actual}`);
  }
  if (citationCheck.flagged.length > 0) {
    console.log(`  ⚠ flagged for manual read: answer cites ${citationCheck.flagged.join(", ")} — verify it's contrasting, not conflating`);
  }
  if (!keywordCheck) {
    console.log(`  keywords: none of [${(testCase.expectedKeywords ?? []).join(", ")}] found in grounded answer`);
  }
  console.log(`\n  GROUNDED:\n  ${groundedAnswer.trim().replace(/\n/g, "\n  ")}`);
  console.log(`\n  UNGROUNDED:\n  ${ungroundedAnswer.trim().replace(/\n/g, "\n  ")}`);
  console.log(`\n  ${formatUsageLine(usage)}`);
  return pass;
}

async function main() {
  const storePath = path.join(projectRoot, "index", "store.json");
  if (!fs.existsSync(storePath)) {
    console.error("eval: no index found — run `npm run ingest` first.");
    process.exit(1);
  }

  const questions = JSON.parse(fs.readFileSync(questionsPath, "utf8"));
  const results = [];
  const sessionUsage = { embeddingTokens: 0, inputTokens: 0, outputTokens: 0 };
  for (const testCase of questions) {
    const result = await runCase(testCase);
    sessionUsage.embeddingTokens += result.usage.embeddingTokens;
    sessionUsage.inputTokens += result.usage.inputTokens;
    sessionUsage.outputTokens += result.usage.outputTokens;
    results.push(printCase(result));
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`${passed}/${results.length} passed`);
  console.log(`session total — ${formatUsageLine(sessionUsage)}`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(`eval: ${err.message}`);
  process.exit(1);
});
