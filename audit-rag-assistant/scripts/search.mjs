import { fileURLToPath } from "node:url";
import { embedTexts } from "./embed.mjs";
import { formatUsageLine } from "./cost.mjs";
import { getTable } from "./vectorstore.mjs";

const SUMMARY_CANDIDATES = 5;
const RESULT_COUNT = 8;
const MAX_CHUNKS_PER_NOTE = 2;
// Overfetch for stage 2: at most SUMMARY_CANDIDATES notes are ever in
// play, and this corpus is small enough (~100 section chunks total) that
// 50 comfortably covers "every section chunk across the candidate notes"
// in practice, so capPerNote always has a real pool to choose a diverse
// top RESULT_COUNT from rather than being starved by ranking order.
const SECTION_FETCH_LIMIT = 50;

// Phase 5 guardrail (this project only — not in Seth_Wiki): the minimum
// top-chunk cosine similarity below which answer.mjs refuses to generate
// at all. Picked empirically against this corpus's real query/score
// distribution during eval — see README's guardrails section, not derived
// from first principles.
export const MIN_RETRIEVAL_SCORE = 0.3;

function quoteList(values) {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
}

function quoteValue(v) {
  return `'${v.replace(/'/g, "''")}'`;
}

// `corpus` is "generic" | "tailored" | undefined ("both", the default —
// no filter at all).
function corpusFilter(corpus) {
  return corpus ? ` AND corpus = ${quoteValue(corpus)}` : "";
}

function capPerNote(scored, maxPerNote, limit) {
  const counts = new Map();
  const kept = [];
  for (const item of scored) {
    const count = counts.get(item.chunk.noteId) ?? 0;
    if (count >= maxPerNote) continue;
    counts.set(item.chunk.noteId, count + 1);
    kept.push(item);
    if (kept.length >= limit) break;
  }
  return kept;
}

// vectorstore.mjs stores "" for the nullable `updated` field (LanceDB's
// Arrow schema inference can't handle a null in the first row) — restore
// the original null-means-unknown contract answer.mjs's `sources` display
// already relies on.
function toChunk(row) {
  const { vector, _distance, ...rest } = row;
  return { ...rest, updated: rest.updated || null };
}

// Two-stage retrieval: LanceDB does the ANN ranking now (ported from
// Seth_Wiki's brute-force in-memory version), capPerNote's diversity cap
// stays in JS since LanceDB has no "max N per group" primitive.
//
// `corpus` scopes both stages to "generic" or "tailored"; omitted (the
// default) searches both combined. Scoping happens upstream of the
// diversity cap, which is what lets capPerNote work unchanged in every
// scope — for a single-scope request it never sees an out-of-scope chunk,
// and for the combined "both" scope it applies globally exactly as it did
// before multi-corpus support existed.
export async function retrieve(query, { corpus } = {}) {
  const table = await getTable();
  const { embeddings: [queryVector], usage: embedUsage } = await embedTexts([query]);
  const scopeFilter = corpusFilter(corpus);

  const summaryRows = await table
    .search(queryVector)
    .distanceType("cosine")
    .where(`kind = 'summary'${scopeFilter}`)
    .limit(SUMMARY_CANDIDATES)
    .toArray();
  const candidateNoteIds = [...new Set(summaryRows.map((row) => row.noteId))];

  if (candidateNoteIds.length === 0) {
    return { results: [], usage: { embeddingTokens: embedUsage.totalTokens } };
  }

  const sectionRows = await table
    .search(queryVector)
    .distanceType("cosine")
    .where(`kind = 'section' AND noteId IN (${quoteList(candidateNoteIds)})${scopeFilter}`)
    .limit(SECTION_FETCH_LIMIT)
    .toArray();

  // LanceDB's cosine _distance is 0 = identical (the inverse of the
  // higher-is-better cosine-similarity `score` MIN_RETRIEVAL_SCORE and
  // every downstream consumer already expect) — convert once, here.
  const scored = sectionRows.map((row) => ({ chunk: toChunk(row), score: 1 - row._distance }));
  const results = capPerNote(scored, MAX_CHUNKS_PER_NOTE, RESULT_COUNT);
  return { results, usage: { embeddingTokens: embedUsage.totalTokens } };
}

function parseCorpusFlag(args) {
  const idx = args.indexOf("--corpus");
  if (idx === -1) return { corpus: undefined, rest: args };
  const rest = [...args.slice(0, idx), ...args.slice(idx + 2)];
  return { corpus: args[idx + 1], rest };
}

async function main() {
  const { corpus, rest } = parseCorpusFlag(process.argv.slice(2));
  const query = rest.join(" ").trim();
  if (!query) {
    console.error('search: usage: npm run search -- "your query" [--corpus generic|tailored]');
    process.exit(1);
  }

  const { results, usage } = await retrieve(query, { corpus });

  if (results.length === 0) {
    console.log("search: no results.");
    return;
  }

  for (const { chunk, score } of results) {
    const preview = chunk.text.replace(/\s+/g, " ").slice(0, 140);
    console.log(`${score.toFixed(3)}  (${chunk.corpusSource}) ${chunk.title} — ${chunk.heading}`);
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
