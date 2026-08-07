import path from "node:path";
import * as lancedb from "@lancedb/lancedb";
import { projectRoot } from "./lib.mjs";

// index/ is gitignored (see .gitignore) except this directory: LanceDB's
// local files are the committed, deployment-critical artifact — the thing
// that lets Streamlit Cloud serve real answers without running
// `npm run ingest` itself. index/store.json remains a separate, purely
// local ingest-time cache (see ingest.mjs).
const dbPath = path.join(projectRoot, "index", "lancedb");
const TABLE_NAME = "chunks";

let dbPromise;
function getDb() {
  if (!dbPromise) dbPromise = lancedb.connect(dbPath);
  return dbPromise;
}

// Full rebuild on every ingest — this corpus is ~20 docs / ~100 chunks,
// so overwriting is fast and avoids upsert/diff logic a table this small
// doesn't need. Renames `embedding` -> `vector` (LanceDB's expected column)
// and coerces nullable string fields (`heading` is null for summary-kind
// chunks; `updated` is null if a file's git-log lookup ever fails) to "" —
// LanceDB infers its Arrow schema from the first row, and a null there
// makes type inference fail outright ("Failed to infer data type").
// search.mjs converts "" back to null on read for `updated`, the one
// nullable field that can actually reach a returned result.
export async function rebuildTable(chunks) {
  const db = await getDb();
  const rows = chunks.map(({ embedding, heading, updated, ...rest }) => ({
    ...rest,
    heading: heading ?? "",
    updated: updated ?? "",
    vector: embedding,
  }));
  return db.createTable(TABLE_NAME, rows, { mode: "overwrite" });
}

export async function getTable() {
  const db = await getDb();
  const names = await db.tableNames();
  if (!names.includes(TABLE_NAME)) {
    throw new Error("no index found — run `npm run ingest` first.");
  }
  return db.openTable(TABLE_NAME);
}
