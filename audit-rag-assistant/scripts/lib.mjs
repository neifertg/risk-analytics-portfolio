import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(scriptsDir, "..");
export const corpusDir = path.join(projectRoot, "corpus");
export const corpusTailoredDir = path.join(projectRoot, "corpus-tailored");

export const GENERIC_CORPUS_SOURCE = "Generic Audit Methodology";

// Unlike Seth_Wiki's PARA-aware walkNotes(), this corpus is one flat
// folder — no folder-type distinctions needed for a fixed ~10-doc demo.
export function walkCorpus() {
  if (!fs.existsSync(corpusDir)) return [];
  return fs
    .readdirSync(corpusDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(corpusDir, f));
}

function tailoredSourceLabel(slug) {
  return slug
    .split("-")
    .map((w) => w.toUpperCase())
    .join(" ");
}

// Multi-corpus discovery: corpus/ (generic, self-written) plus
// corpus-tailored/<org-slug>/ (a real organization's own real documents,
// one folder per org). Each result is tagged with which corpus it belongs
// to and a human-readable source label, derived purely from the folder —
// none of the existing generic docs need any edit. A note's own
// frontmatter `source` field, if present, overrides the folder-derived
// label (checked by ingest.mjs, not here — this function stays a pure
// file-discovery layer, same shape as walkCorpus()).
export function walkCorpora() {
  const generic = walkCorpus().map((file) => ({
    file,
    corpus: "generic",
    corpusSource: GENERIC_CORPUS_SOURCE,
  }));

  if (!fs.existsSync(corpusTailoredDir)) return generic;

  const tailored = fs
    .readdirSync(corpusTailoredDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const dir = path.join(corpusTailoredDir, entry.name);
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => ({
          file: path.join(dir, f),
          corpus: "tailored",
          corpusSource: tailoredSourceLabel(entry.name),
        }));
    });

  return [...generic, ...tailored];
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
