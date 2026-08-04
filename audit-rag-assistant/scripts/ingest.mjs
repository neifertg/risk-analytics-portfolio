import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { walkCorpus, projectRoot } from "./lib.mjs";
import { chunkNote } from "./chunk.mjs";
import { embedTexts } from "./embed.mjs";

// index/ is gitignored — a regenerable local cache, not content. Same
// pattern as Seth_Wiki: re-run this after editing corpus docs.
const indexDir = path.join(projectRoot, "index");
const storePath = path.join(indexDir, "store.json");

function loadExistingStore() {
  if (!fs.existsSync(storePath)) return new Map();
  const raw = JSON.parse(fs.readFileSync(storePath, "utf8"));
  return new Map(Object.entries(raw));
}

async function main() {
  const existing = loadExistingStore();
  const newStore = new Map();
  let reused = 0;
  let embedded = 0;

  for (const file of walkCorpus()) {
    const raw = fs.readFileSync(file, "utf8");
    const { data, content } = matter(raw);
    if (!data.id) continue;

    const chunks = chunkNote({ data, content });
    const toEmbed = [];

    for (const chunk of chunks) {
      const prior = existing.get(chunk.chunkId);
      if (prior && prior.contentHash === chunk.contentHash) {
        newStore.set(chunk.chunkId, prior);
        reused++;
      } else {
        toEmbed.push(chunk);
      }
    }

    if (toEmbed.length > 0) {
      const { embeddings: vectors } = await embedTexts(toEmbed.map((c) => c.text));
      toEmbed.forEach((chunk, i) => {
        newStore.set(chunk.chunkId, { ...chunk, embedding: vectors[i] });
      });
      embedded += toEmbed.length;
    }
  }

  const pruned = [...existing.keys()].filter((id) => !newStore.has(id)).length;

  fs.mkdirSync(indexDir, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(Object.fromEntries(newStore), null, 2));

  console.log(
    `ingest: ${newStore.size} chunk(s) total (${embedded} embedded, ${reused} reused, ${pruned} pruned)`
  );
}

main().catch((err) => {
  console.error(`ingest: ${err.message}`);
  process.exit(1);
});
