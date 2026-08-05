#!/usr/bin/env node
// deck.yaml -> self-contained reveal.js index.html. See PATTERN.md for the
// layout taxonomy this script implements.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const REVEAL_VERSION = '5.1.0';
// Keep in sync with brand/tokens.css's [data-theme="..."] blocks and
// scripts/check-contrast.mjs's THEMES list — this is the presenter-facing
// runtime toggle (press "T" to cycle), not a deck.yaml-authored choice.
const THEMES = ['slate', 'forest', 'copper'];

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

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function substitute(template, fields) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => fields[key] ?? '');
}

function notesBlock(notes) {
  return notes ? `<aside class="notes">${esc(notes)}</aside>` : '';
}

const MIME_BY_EXT = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// A relative path (e.g. "assets/kmeans.svg", resolved against the deck.yaml's
// own directory) is embedded as a base64 data URI so the rendered index.html
// stays a single self-contained file — a placeholder marker, external URL,
// or existing data URI passes through untouched.
function resolveEvidenceSrc(src, deckDir) {
  if (!src || src === 'PLACEHOLDER' || /^(https?:)?\/\//.test(src) || src.startsWith('data:')) {
    return src;
  }
  const filePath = path.resolve(deckDir, src);
  const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const data = fs.readFileSync(filePath);
  return `data:${mime};base64,${data.toString('base64')}`;
}

const layoutCache = new Map();
function loadLayout(name) {
  if (!layoutCache.has(name)) {
    const file = path.join(REPO_ROOT, 'layouts', `${name}.html`);
    layoutCache.set(name, fs.readFileSync(file, 'utf8'));
  }
  return layoutCache.get(name);
}

const renderers = {
  title(slide, ctx) {
    const subtitleHtml = slide.subtitle ? `<p class="subtitle">${esc(slide.subtitle)}</p>` : '';
    const metaText = [slide.author, slide.date].filter(Boolean).map(esc).join(' &middot; ');
    return substitute(loadLayout('title'), {
      logoSvgMarkup: ctx.logoSvgMarkup,
      title: esc(slide.title),
      subtitleHtml,
      metaText,
      notesHtml: notesBlock(slide.notes),
    });
  },
  agenda(slide) {
    const itemsHtml = (slide.items || []).map((item) => `<li>${esc(item)}</li>`).join('\n');
    return substitute(loadLayout('agenda'), {
      title: esc(slide.title || 'Agenda'),
      itemsHtml,
      notesHtml: notesBlock(slide.notes),
    });
  },
  'section-divider'(slide) {
    const labelHtml = slide.label ? `<p class="label">${esc(slide.label)}</p>` : '';
    return substitute(loadLayout('section-divider'), {
      labelHtml,
      title: esc(slide.title),
      notesHtml: notesBlock(slide.notes),
    });
  },
  'assertion-evidence'(slide, ctx) {
    const ev = slide.evidence || {};
    let evidenceHtml = '';
    if (ev.type === 'image' || ev.type === 'diagram') {
      const src = resolveEvidenceSrc(ev.src, ctx.deckDir);
      evidenceHtml = `<img src="${esc(src)}" alt="${esc(ev.alt || '')}" />`;
    } else if (ev.type === 'table') {
      const rows = ev.rows || [];
      const [header, ...body] = rows;
      const theadHtml = header
        ? `<thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>`
        : '';
      const tbodyHtml = `<tbody>${body
        .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      evidenceHtml = `<table>${theadHtml}${tbodyHtml}</table>`;
    }
    const captionHtml = slide.caption ? `<p class="caption">${esc(slide.caption)}</p>` : '';
    return substitute(loadLayout('assertion-evidence'), {
      headline: esc(slide.headline),
      evidenceHtml,
      captionHtml,
      notesHtml: notesBlock(slide.notes),
    });
  },
  'big-stat'(slide) {
    return substitute(loadLayout('big-stat'), {
      stat: esc(slide.stat),
      context: esc(slide.context || ''),
      notesHtml: notesBlock(slide.notes),
    });
  },
  comparison(slide) {
    const columnsHtml = (slide.columns || [])
      .map((col) => {
        const pointsHtml = (col.points || []).map((p) => `<li>${esc(p)}</li>`).join('');
        return `<div class="column"><h3>${esc(col.heading)}</h3><ul>${pointsHtml}</ul></div>`;
      })
      .join('\n');
    return substitute(loadLayout('comparison'), {
      columnsHtml,
      notesHtml: notesBlock(slide.notes),
    });
  },
  timeline(slide) {
    const stepsHtml = (slide.steps || [])
      .map(
        (s) =>
          `<div class="step"><div class="label">${esc(s.label)}</div><div class="detail">${esc(
            s.detail || ''
          )}</div></div>`
      )
      .join('\n');
    return substitute(loadLayout('timeline'), {
      headline: esc(slide.headline || ''),
      stepsHtml,
      notesHtml: notesBlock(slide.notes),
    });
  },
  quote(slide) {
    return substitute(loadLayout('quote'), {
      quote: esc(slide.quote),
      attribution: esc(slide.attribution || ''),
      notesHtml: notesBlock(slide.notes),
    });
  },
  closing(slide) {
    return substitute(loadLayout('closing'), {
      headline: esc(slide.headline),
      cta: esc(slide.cta || ''),
      notesHtml: notesBlock(slide.notes),
    });
  },
};

function renderSlide(slide, index, ctx) {
  const renderer = renderers[slide.layout];
  if (!renderer) {
    throw new Error(
      `slide ${index + 1}: unknown layout "${slide.layout}" — must be one of ${Object.keys(
        REQUIRED_FIELDS
      ).join(', ')}`
    );
  }
  return renderer(slide, ctx);
}

function main() {
  const deckPath = process.argv[2];
  if (!deckPath) {
    console.error('Usage: node scripts/render.mjs <path-to-deck.yaml>');
    process.exit(1);
  }
  const resolvedDeckPath = path.resolve(process.cwd(), deckPath);
  const deck = yaml.load(fs.readFileSync(resolvedDeckPath, 'utf8'));

  const tokensCss = fs.readFileSync(path.join(REPO_ROOT, 'brand', 'tokens.css'), 'utf8');
  // Inlined (not a base64 <img> data URI) so its fill="currentColor" can
  // pick up --color-accent and respond to the theme toggle — an <img>
  // referencing an external/data-URI SVG is an opaque resource that can't
  // see the host page's CSS custom properties.
  const logoSvgMarkup = fs.readFileSync(path.join(REPO_ROOT, 'brand', 'logo-placeholder.svg'), 'utf8').trim();

  const ctx = { logoSvgMarkup, deckTitle: deck.title, deckDir: path.dirname(resolvedDeckPath) };
  const sectionsHtml = deck.slides.map((slide, i) => renderSlide(slide, i, ctx)).join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(deck.title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@${REVEAL_VERSION}/dist/reveal.css" />
<style>
${tokensCss}
</style>
</head>
<body>
<div class="reveal">
  <div class="brand-corner-mark">${logoSvgMarkup}</div>
  <div class="slides">
${sectionsHtml}
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/reveal.js@${REVEAL_VERSION}/dist/reveal.js"></script>
<script src="https://cdn.jsdelivr.net/npm/reveal.js@${REVEAL_VERSION}/plugin/notes/notes.js"></script>
<script>
  Reveal.initialize({
    hash: true,
    width: 1920,
    height: 1080,
    margin: 0.04,
    plugins: typeof RevealNotes !== 'undefined' ? [ RevealNotes ] : []
  });
</script>
<script>
  // Presenter-only color-theme toggle — press "T" to cycle. No on-screen
  // control by design (PATTERN.md §7's no-decorative-chrome rule).
  (function () {
    var THEMES = ${JSON.stringify(THEMES)};
    var root = document.documentElement;
    root.dataset.theme = root.dataset.theme || THEMES[0];
    document.addEventListener('keydown', function (e) {
      if (e.key !== 't' && e.key !== 'T') return;
      var i = THEMES.indexOf(root.dataset.theme);
      root.dataset.theme = THEMES[(i + 1) % THEMES.length];
    });
  })();
</script>
</body>
</html>
`;

  const outPath = path.join(path.dirname(resolvedDeckPath), 'index.html');
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`Rendered ${deck.slides.length} slides -> ${outPath}`);
  console.log(`Press "T" while presenting to cycle color themes (${THEMES.join(' -> ')}).`);
}

main();
