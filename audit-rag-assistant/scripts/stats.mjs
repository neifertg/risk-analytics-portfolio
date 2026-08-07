import fs from "node:fs";
import matter from "gray-matter";
import { fileURLToPath } from "node:url";
import { walkCorpus } from "./lib.mjs";
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

  for (const file of walkCorpus()) {
    const raw = fs.readFileSync(file, "utf8");
    const { data } = matter(raw);
    if (!data.id) continue;
    topics.push({ id: data.id, title: data.title });
  }
  topics.sort((a, b) => a.title.localeCompare(b.title));

  const { totalChunks, sectionChunks } = await countChunks();

  return { totalDocs: topics.length, totalChunks, sectionChunks, topics };
}

async function main() {
  const asJson = process.argv.includes("--json");
  const stats = await computeStats();

  if (asJson) {
    console.log(JSON.stringify(stats));
    return;
  }

  console.log(`${stats.totalDocs} documents indexed (${stats.sectionChunks} section chunks):`);
  for (const { title } of stats.topics) {
    console.log(`  - ${title}`);
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
