import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectRoot } from "./lib.mjs";
import { embedTexts } from "./embed.mjs";
import { formatUsageLine } from "./cost.mjs";

const storePath = path.join(projectRoot, "index", "store.json");

const SUMMARY_CANDIDATES = 5;
const RESULT_COUNT = 8;
const MAX_CHUNKS_PER_NOTE = 2;

// Phase 5 guardrail (this project only — not in Seth_Wiki): the minimum
// top-chunk cosine similarity below which answer.mjs refuses to generate
// at all. Picked empirically against this corpus's real query/score
// distribution during eval — see README's guardrails section, not derived
// from first principles.
export const MIN_RETRIEVAL_SCORE = 0.3;

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function rank(chunks, queryVector) {
  return chunks
    .map((chunk) => ({ chunk, score: cosineSimilarity(chunk.embedding, queryVector) }))
    .sort((a, b) => b.score - a.score);
}

function capPerNote(ranked, maxPerNote, limit) {
  const counts = new Map();
  const kept = [];
  for (const item of ranked) {
    const count = counts.get(item.chunk.noteId) ?? 0;
    if (count >= maxPerNote) continue;
    counts.set(item.chunk.noteId, count + 1);
    kept.push(item);
    if (kept.length >= limit) break;
  }
  return kept;
}

// Two-stage retrieval, ported as-is from Seth_Wiki's search.mjs.
export async function retrieve(query) {
  if (!fs.existsSync(storePath)) {
    throw new Error("no index found — run `npm run ingest` first.");
  }

  const store = Object.values(JSON.parse(fs.readFileSync(storePath, "utf8")));
  const { embeddings: [queryVector], usage: embedUsage } = await embedTexts([query]);

  const summaryChunks = store.filter((c) => c.kind === "summary");
  const candidateNoteIds = new Set(
    rank(summaryChunks, queryVector)
      .slice(0, SUMMARY_CANDIDATES)
      .map(({ chunk }) => chunk.noteId)
  );

  const sectionChunks = store.filter((c) => c.kind === "section" && candidateNoteIds.has(c.noteId));
  const results = capPerNote(rank(sectionChunks, queryVector), MAX_CHUNKS_PER_NOTE, RESULT_COUNT);
  return { results, usage: { embeddingTokens: embedUsage.totalTokens } };
}

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error('search: usage: npm run search -- "your query"');
    process.exit(1);
  }

  const { results, usage } = await retrieve(query);

  if (results.length === 0) {
    console.log("search: no results.");
    return;
  }

  for (const { chunk, score } of results) {
    const preview = chunk.text.replace(/\s+/g, " ").slice(0, 140);
    console.log(`${score.toFixed(3)}  ${chunk.title} — ${chunk.heading}`);
    console.log(`       ${preview}${chunk.text.length > 140 ? "…" : ""}`);
  }

  console.log(`\n${formatUsageLine(usage)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`search: ${err.message}`);
    process.exit(1);
  });
}
