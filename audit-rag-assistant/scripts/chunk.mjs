import crypto from "node:crypto";
import { parseHeadings, GENERIC_CORPUS_SOURCE } from "./lib.mjs";

// Chunking pipeline, ported from Seth_Wiki: split each doc by H2, falling
// back to H3 only when a section is unusually long. Pure function — no
// file I/O here.

// Generous ceiling in characters, not tokens — same reasoning as the
// source: don't hand an embedding model an unreasonably huge section.
const MAX_CHUNK_CHARS = 6000;

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function contentHash(text) {
  return "sha256:" + crypto.createHash("sha256").update(text).digest("hex");
}

function sliceLines(lines, startLineIndex, endLineIndex) {
  return lines.slice(startLineIndex, endLineIndex).join("\n").trim();
}

function baseMetadata(data) {
  return {
    noteId: data.id,
    title: data.title,
    type: data.type,
    updated: data.updated ?? null,
    // Always populated by ingest.mjs (never nullable, unlike `updated`) —
    // the fallback here only guards a caller that forgets to set them.
    corpus: data.corpus ?? "generic",
    corpusSource: data.corpusSource ?? GENERIC_CORPUS_SOURCE,
  };
}

function makeChunk(data, kind, heading, text) {
  const meta = baseMetadata(data);
  const chunkId = kind === "summary" ? `${meta.noteId}#summary` : `${meta.noteId}#section-${slugify(heading)}`;
  return { chunkId, ...meta, heading: heading ?? null, kind, text, contentHash: contentHash(text) };
}

function splitByH3(data, h2Heading, lines, sectionHeadings, sectionStart, sectionEnd) {
  const h3s = sectionHeadings.filter((h) => h.depth === 3);
  if (h3s.length === 0) {
    return [makeChunk(data, "section", h2Heading, sliceLines(lines, sectionStart, sectionEnd))];
  }

  const chunks = [];
  const preamble = sliceLines(lines, sectionStart, h3s[0].lineIndex);
  if (preamble) chunks.push(makeChunk(data, "section", h2Heading, preamble));

  for (let i = 0; i < h3s.length; i++) {
    const start = h3s[i].lineIndex;
    const end = i + 1 < h3s.length ? h3s[i + 1].lineIndex : sectionEnd;
    const text = sliceLines(lines, start, end);
    if (text) chunks.push(makeChunk(data, "section", `${h2Heading} > ${h3s[i].text}`, text));
  }
  return chunks;
}

export function chunkNote({ data, content }) {
  const lines = content.split(/\r?\n/);
  const headings = parseHeadings(content);
  const h2s = headings.filter((h) => h.depth === 2);

  const chunks = [];
  if (data.summary) {
    chunks.push(makeChunk(data, "summary", null, data.summary.trim()));
  }

  for (let i = 0; i < h2s.length; i++) {
    const sectionStart = h2s[i].lineIndex;
    // Skip "Related" sections entirely — found live via eval.mjs against
    // the real corpus (2026-08-03): a Related section is just a bulleted
    // list of markdown links to other docs, so it literally contains
    // those other docs' exact titles as anchor text. That makes it embed
    // suspiciously close to any query mentioning those titles — closer
    // than genuinely relevant prose, which discusses concepts in natural
    // sentences rather than exact title strings — so boilerplate nav
    // chunks were outranking real content. Not present in Seth_Wiki's
    // chunk.mjs; worth backporting there too, but out of scope here.
    if (h2s[i].text.trim().toLowerCase() === "related") continue;

    const sectionEnd = i + 1 < h2s.length ? h2s[i + 1].lineIndex : lines.length;
    const text = sliceLines(lines, sectionStart, sectionEnd);
    if (!text) continue;

    if (text.length <= MAX_CHUNK_CHARS) {
      chunks.push(makeChunk(data, "section", h2s[i].text, text));
      continue;
    }

    const sectionHeadings = headings.filter(
      (h) => h.lineIndex > sectionStart && h.lineIndex < sectionEnd
    );
    chunks.push(...splitByH3(data, h2s[i].text, lines, sectionHeadings, sectionStart, sectionEnd));
  }

  return chunks;
}
