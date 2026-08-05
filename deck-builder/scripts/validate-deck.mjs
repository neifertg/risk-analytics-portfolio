#!/usr/bin/env node
// Lints a deck.yaml against the structure/density rules in PATTERN.md.
// Exit 0 + warnings printed = pass with advice. Exit 1 = hard failure.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const REQUIRED_FIELDS = {
  title: ['title'],
  agenda: ['items'],
  'section-divider': ['title'],
  'assertion-evidence': ['headline', 'evidence'],
  'big-stat': ['stat'],
  comparison: ['columns'],
  timeline: ['steps'],
  quote: ['quote'],
  closing: ['headline'],
};

const NON_CONTENT_LAYOUTS = new Set(['title', 'section-divider', 'closing', 'agenda']);
const HEADLINE_SOFT_CAP = 90;
const HEADLINE_HARD_CAP = 140;
const CONTENT_SLIDE_WARN = 15;
const TABLE_CELL_WARN = 70;
const EVIDENCE_RATIO_MIN = 1.1;
const EVIDENCE_RATIO_MAX = 2.4;

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

// Mirrors render.mjs's resolveEvidenceSrc: a placeholder marker, external
// URL, or existing data URI is already "resolved" and not a local path to
// check on disk.
function isLocalEvidencePath(src) {
  return Boolean(src) && src !== 'PLACEHOLDER' && !/^(https?:)?\/\//.test(src) && !src.startsWith('data:');
}

// Dependency-free image-dimension sniff, used only for the evidence
// aspect-ratio warning below. Handles the two formats this pipeline
// actually produces (SVG diagrams, PNG screenshots); returns null for
// anything else rather than adding a parser for formats not in use.
function getImageDimensions(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.svg') {
    const text = fs.readFileSync(filePath, 'utf8');
    const viewBoxMatch = text.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
    if (viewBoxMatch) {
      return { width: parseFloat(viewBoxMatch[1]), height: parseFloat(viewBoxMatch[2]) };
    }
    const widthMatch = text.match(/\bwidth=["']([\d.]+)/i);
    const heightMatch = text.match(/\bheight=["']([\d.]+)/i);
    if (widthMatch && heightMatch) {
      return { width: parseFloat(widthMatch[1]), height: parseFloat(heightMatch[1]) };
    }
    return null;
  }
  if (ext === '.png') {
    const buf = Buffer.alloc(24);
    const fd = fs.openSync(filePath, 'r');
    try {
      fs.readSync(fd, buf, 0, 24, 0);
    } finally {
      fs.closeSync(fd);
    }
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  return null;
}

function main() {
  const deckPath = process.argv[2];
  if (!deckPath) {
    console.error('Usage: node scripts/validate-deck.mjs <path-to-deck.yaml>');
    process.exit(1);
  }
  const resolvedPath = path.resolve(process.cwd(), deckPath);
  const deckDir = path.dirname(resolvedPath);
  const deck = yaml.load(fs.readFileSync(resolvedPath, 'utf8'));

  const errors = [];
  const warnings = [];

  if (isBlank(deck.title)) errors.push('deck.title is required');
  if (isBlank(deck.objective)) {
    warnings.push('deck.objective is not set — the evidence-review step needs it to judge coherence (PATTERN.md §3, Top-level deck fields)');
  }
  if (isBlank(deck.audience)) {
    warnings.push('deck.audience is not set — the evidence-review step needs it to judge coherence (PATTERN.md §3, Top-level deck fields)');
  }
  if (!Array.isArray(deck.slides) || deck.slides.length === 0) {
    errors.push('deck.slides must be a non-empty array');
  } else {
    const slides = deck.slides;
    if (slides[0].layout !== 'title') errors.push('first slide must have layout: title');
    if (slides[slides.length - 1].layout !== 'closing') {
      errors.push('last slide must have layout: closing');
    }

    let contentCount = 0;
    slides.forEach((slide, i) => {
      const n = i + 1;
      const required = REQUIRED_FIELDS[slide.layout];
      if (!required) {
        errors.push(
          `slide ${n}: unknown layout "${slide.layout}" — must be one of ${Object.keys(
            REQUIRED_FIELDS
          ).join(', ')}`
        );
        return;
      }
      for (const field of required) {
        if (isBlank(slide[field])) {
          errors.push(`slide ${n} (${slide.layout}): missing required field "${field}"`);
        }
      }
      if (typeof slide.headline === 'string') {
        if (slide.headline.length > HEADLINE_HARD_CAP) {
          errors.push(
            `slide ${n}: headline is ${slide.headline.length} chars, over the ${HEADLINE_HARD_CAP}-char hard cap`
          );
        } else if (slide.headline.length > HEADLINE_SOFT_CAP) {
          warnings.push(
            `slide ${n}: headline is ${slide.headline.length} chars — aim for ~${HEADLINE_SOFT_CAP} (PATTERN.md §4)`
          );
        }
      }
      if (slide.evidence?.type === 'table' && Array.isArray(slide.evidence.rows)) {
        slide.evidence.rows.forEach((row, rowIndex) => {
          (row || []).forEach((cell) => {
            if (typeof cell === 'string' && cell.length > TABLE_CELL_WARN) {
              warnings.push(
                `slide ${n}: table row ${rowIndex + 1} has a ${cell.length}-char cell — aim for ~${TABLE_CELL_WARN} (PATTERN.md §4, evidence not bullets)`
              );
            }
          });
        });
      }

      if (
        (slide.evidence?.type === 'image' || slide.evidence?.type === 'diagram') &&
        isLocalEvidencePath(slide.evidence.src)
      ) {
        const evidencePath = path.resolve(deckDir, slide.evidence.src);
        if (!fs.existsSync(evidencePath)) {
          errors.push(`slide ${n}: evidence.src "${slide.evidence.src}" does not resolve to a file (looked for ${evidencePath})`);
        } else {
          const dims = getImageDimensions(evidencePath);
          if (dims && dims.height > 0) {
            const ratio = dims.width / dims.height;
            if (ratio < EVIDENCE_RATIO_MIN || ratio > EVIDENCE_RATIO_MAX) {
              warnings.push(
                `slide ${n}: evidence image is ${dims.width}x${dims.height} (ratio ${ratio.toFixed(2)}:1) — aim for ~1.3-2:1 landscape (PATTERN.md §4)`
              );
            }
          }
        }
      }

      if (!NON_CONTENT_LAYOUTS.has(slide.layout)) contentCount += 1;
    });

    if (contentCount > CONTENT_SLIDE_WARN) {
      warnings.push(
        `deck has ${contentCount} content slides (over ${CONTENT_SLIDE_WARN}) — consider cutting or splitting per PATTERN.md §4`
      );
    }

    const placeholderMatches = [];
    const placeholderRegex = /\b(?:TODO|todo|Lorem|lorem|SCREENSHOT NEEDED)\b|\[insert|\[screenshot/i;
    function scanValue(value, path) {
      if (typeof value === 'string') {
        if (placeholderRegex.test(value)) {
          placeholderMatches.push(`${path}: ${value}`);
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => scanValue(item, `${path}[${index}]`));
      } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, child]) => scanValue(child, `${path}.${key}`));
      }
    }

    slides.forEach((slide, i) => scanValue(slide, `slides[${i}]`));
    if (placeholderMatches.length > 0) {
      warnings.push(
        `deck contains placeholder text (${placeholderMatches.length} match${placeholderMatches.length === 1 ? '' : 'es'}) — review: ${placeholderMatches
          .slice(0, 5)
          .join(' | ')}`
      );
    }

    console.log('Ghost deck outline:');
    slides.forEach((slide, i) => {
      const n = i + 1;
      const summary = getGhostOutlineText(slide);
      console.log(`${n}. ${slide.layout}: ${summary}`);
    });
  }

  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);

  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
    process.exit(1);
  }
  console.log(`OK — ${warnings.length} warning(s).`);
}

function getGhostOutlineText(slide) {
  switch (slide.layout) {
    case 'title':
      return slide.title || 'Untitled';
    case 'agenda':
      return Array.isArray(slide.items) ? slide.items.join(' / ') : 'Agenda';
    case 'section-divider':
      return slide.title || slide.label || 'Section';
    case 'assertion-evidence':
      return slide.headline || 'Assertion';
    case 'big-stat':
      return slide.context ? `${slide.stat} — ${slide.context}` : `${slide.stat}`;
    case 'comparison':
      return Array.isArray(slide.columns)
        ? slide.columns.map((col) => col.heading).join(' vs. ')
        : 'Comparison';
    case 'timeline':
      return Array.isArray(slide.steps)
        ? slide.steps.map((step) => step.label || step.detail).join(' → ')
        : 'Timeline';
    case 'quote':
      return slide.quote || 'Quote';
    case 'closing':
      return slide.headline || 'Closing';
    default:
      return 'Slide';
  }
}

main();
