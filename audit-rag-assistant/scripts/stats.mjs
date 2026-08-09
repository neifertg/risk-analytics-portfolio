import fs from "node:fs";
import matter from "gray-matter";
import { fileURLToPath } from "node:url";
import { walkCorpora } from "./lib.mjs";
import { getTable } from "./vectorstore.mjs";

// Corpus-coverage stats for the app's sidebar. Document list reads live
// frontmatter directly (the same source of truth ingest.mjs reads), so
// it's accurate even if `npm run ingest` hasn't been rerun since the
// corpus last changed. Chunk counts come from the committed LanceDB
// table (index/lancedb/), same source search.mjs queries — not
// index/store.json, which is now purely a local ingest-time cache.
// Unlike Seth_Wiki's stats.mjs, this corpus has no `type` variety (every
// doc is "procedure") and no `tags` field to count — so "coverage" here
// means the actual list of document titles, not a type/tag breakdown.

async function countChunks() {
  let table;
  try {
    table = await getTable();
  } catch {
    return { totalChunks: 0, sectionChunks: 0 };
  }
  const chunks = await table.query().toArray();
  const sectionChunks = chunks.filter((c) => c.kind === "section").length;
  return { totalChunks: chunks.length, sectionChunks };
}

export async function computeStats() {
  const topics = [];
  // The folder-derived label (e.g. "UC UCLA") identifies the tailored
  // *scope* as a whole — distinct from each doc's own `corpusSource`,
  // which individual notes override per-document (e.g. "UCLA — Facilities
  // Management" vs "UC Irvine Internal Audit Services") for accurate
  // per-citation attribution. The scope-level UI (app.py's corpus-scope
  // selector) needs the former, not whichever doc's override happens to
  // sort first.
  let tailoredOrgLabel = null;

  for (const { file, corpus, corpusSource } of walkCorpora()) {
    const raw = fs.readFileSync(file, "utf8");
    const { data } = matter(raw);
    if (!data.id) continue;
    if (corpus === "tailored" && !tailoredOrgLabel) tailoredOrgLabel = corpusSource;
    topics.push({ id: data.id, title: data.title, corpus, corpusSource: data.source ?? corpusSource });
  }
  topics.sort((a, b) => a.title.localeCompare(b.title));

  const { totalChunks, sectionChunks } = await countChunks();

  const byCorpus = {};
  for (const t of topics) {
    byCorpus[t.corpus] = (byCorpus[t.corpus] ?? 0) + 1;
  }

  return { totalDocs: topics.length, totalChunks, sectionChunks, topics, byCorpus, tailoredOrgLabel };
}

async function main() {
  const asJson = process.argv.includes("--json");
  const stats = await computeStats();

  if (asJson) {
    console.log(JSON.stringify(stats));
    return;
  }

  console.log(`${stats.totalDocs} documents indexed (${stats.sectionChunks} section chunks):`);
  console.log(`  by corpus: ${JSON.stringify(stats.byCorpus)}`);
  for (const { title, corpusSource } of stats.topics) {
    console.log(`  - (${corpusSource}) ${title}`);
  }
}

// Guarded so importing computeStats() (app.py's Node caller) doesn't also
// run this file's own CLI main — same pattern as search.mjs/answer.mjs.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`stats: ${err.message}`);
    process.exit(1);
  });
}
