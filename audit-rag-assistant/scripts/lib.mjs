import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(scriptsDir, "..");
export const corpusDir = path.join(projectRoot, "corpus");

// Unlike Seth_Wiki's PARA-aware walkNotes(), this corpus is one flat
// folder — no folder-type distinctions needed for a fixed ~10-doc demo.
export function walkCorpus() {
  if (!fs.existsSync(corpusDir)) return [];
  return fs
    .readdirSync(corpusDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(corpusDir, f));
}

// Parses a note body into its heading list — depth, text, and the line
// it's on — skipping anything inside fenced code blocks. Ported as-is
// from Seth_Wiki's lib.mjs; the chunking contract (H2-per-idea) is the
// same here.
const headingRe = /^(#{1,6})\s+(.*)$/;

export function parseHeadings(content) {
  const lines = content.split(/\r?\n/);
  let inCodeFence = false;
  const headings = [];
  lines.forEach((line, lineIndex) => {
    if (/^```/.test(line.trim())) {
      inCodeFence = !inCodeFence;
      return;
    }
    if (inCodeFence) return;
    const m = line.match(headingRe);
    if (m) headings.push({ depth: m[1].length, text: m[2].trim(), lineIndex });
  });
  return headings;
}
