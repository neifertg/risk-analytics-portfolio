import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { fileURLToPath } from "node:url";
import { walkCorpus, projectRoot } from "./lib.mjs";

// Corpus-coverage stats for the app's sidebar. Reads live frontmatter
// directly (the same source of truth ingest.mjs reads), so it's accurate
// even if `npm run ingest` hasn't been rerun since the corpus last changed.
// Unlike Seth_Wiki's stats.mjs, this corpus has no `type` variety (every
// doc is "procedure") and no `tags` field to count — so "coverage" here
// means the actual list of document titles, not a type/tag breakdown.

const storePath = path.join(projectRoot, "index", "store.json");

function countChunks() {
  if (!fs.existsSync(storePath)) return { totalChunks: 0, sectionChunks: 0 };
  const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
  const chunks = Object.values(store);
  const sectionChunks = chunks.filter((c) => c.kind === "section").length;
  return { totalChunks: chunks.length, sectionChunks };
}

export function computeStats() {
  const topics = [];

  for (const file of walkCorpus()) {
    const raw = fs.readFileSync(file, "utf8");
    const { data } = matter(raw);
    if (!data.id) continue;
    topics.push({ id: data.id, title: data.title });
  }
  topics.sort((a, b) => a.title.localeCompare(b.title));

  const { totalChunks, sectionChunks } = countChunks();

  return { totalDocs: topics.length, totalChunks, sectionChunks, topics };
}

function main() {
  const asJson = process.argv.includes("--json");
  const stats = computeStats();

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
  main();
}
