import fs from "node:fs";
import * as lancedb from "@lancedb/lancedb";

console.log("platform:", process.platform, process.arch);
console.log("cwd:", process.cwd());

function listRecursive(dir, prefix = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      listRecursive(full, prefix);
    } else {
      const stat = fs.statSync(full);
      console.log(`  ${full}  size=${stat.size}`);
    }
  }
}

console.log("--- index/lancedb file listing ---");
listRecursive("index/lancedb");

console.log("--- latest_version_hint.json content ---");
console.log(fs.readFileSync("index/lancedb/chunks.lance/_versions/latest_version_hint.json", "utf8"));

console.log("--- db.tableNames() ---");
const db = await lancedb.connect("index/lancedb");
try {
  const names = await db.tableNames();
  console.log("tableNames:", JSON.stringify(names));
} catch (err) {
  console.log("tableNames threw:", err.message);
}

console.log("--- db.openTable('chunks') direct attempt ---");
try {
  const table = await db.openTable("chunks");
  const rows = await table.query().limit(1).toArray();
  console.log("openTable succeeded, sample row count:", rows.length);
} catch (err) {
  console.log("openTable threw:", err.message);
}
