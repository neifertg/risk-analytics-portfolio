import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import matter from "gray-matter";
import { walkCorpora, projectRoot } from "./lib.mjs";
import { chunkNote } from "./chunk.mjs";
import { embedTexts } from "./embed.mjs";
import { rebuildTable } from "./vectorstore.mjs";

// index/ is gitignored — a regenerable local cache, not content. Same
// pattern as Seth_Wiki: re-run this after editing corpus docs.
const indexDir = path.join(projectRoot, "index");
const storePath = path.join(indexDir, "store.json");

function loadExistingStore() {
  if (!fs.existsSync(storePath)) return new Map();
  const raw = JSON.parse(fs.readFileSync(storePath, "utf8"));
  return new Map(Object.entries(raw));
}

// This corpus has no `updated` frontmatter field (it's synthetic practice
// content, not curated notes) — derive it from git history instead, same
// "generated, not hand-maintained" approach as app.py's coverage line.
// Falls back to null (e.g. an uncommitted new file) rather than throwing.
function lastCommitDate(file) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%ad", "--date=short", "--", file], {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

async function main() {
  const existing = loadExistingStore();
  const newStore = new Map();
  let reused = 0;
  let embedded = 0;
  // Two independently-authored corpora (corpus/ and corpus-tailored/*/)
  // can collide on `id` — a silent overwrite would drop one doc's chunks
  // without any error, so this hard-fails instead.
  const seenIds = new Map();

  for (const { file, corpus, corpusSource } of walkCorpora()) {
    const raw = fs.readFileSync(file, "utf8");
    const { data, content } = matter(raw);
    if (!data.id) continue;

    if (seenIds.has(data.id)) {
      throw new Error(
        `duplicate note id "${data.id}" in both ${seenIds.get(data.id)} and ${file} — ` +
          "ids must be unique across corpus/ and corpus-tailored/"
      );
    }
    seenIds.set(data.id, file);

    // A tailored doc's own frontmatter `source` (if set) overrides the
    // folder-derived label — lets a real org's documents carry their own
    // exact name instead of a mechanically slugified one.
    const noteData = {
      ...data,
      updated: lastCommitDate(file),
      corpus,
      corpusSource: data.source ?? corpusSource,
    };
    const chunks = chunkNote({ data: noteData, content });
    const toEmbed = [];

    for (const chunk of chunks) {
      const prior = existing.get(chunk.chunkId);
      if (prior && prior.contentHash === chunk.contentHash) {
        // Reuse the (expensive) embedding, but keep the freshly computed
        // chunk otherwise — a git-log-derived `updated` date can change
        // between ingest runs even though contentHash (hashed from chunk
        // text alone) stays the same, so without this the new metadata
        // would silently never make it into the store.
        newStore.set(chunk.chunkId, { ...chunk, embedding: prior.embedding });
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

  // The LanceDB table (index/lancedb/, committed) is what search.mjs and
  // stats.mjs actually query — store.json above stays purely a local
  // embedding-reuse cache now, same role Seth_Wiki's version plays.
  await rebuildTable([...newStore.values()]);

  console.log(
    `ingest: ${newStore.size} chunk(s) total (${embedded} embedded, ${reused} reused, ${pruned} pruned)`
  );
}

main().catch((err) => {
  console.error(`ingest: ${err.message}`);
  process.exit(1);
});
