#!/usr/bin/env node
// Checks brand/tokens.css color pairs against WCAG contrast thresholds, per
// PATTERN.md §5/§7. A palette (default or any alternate theme) is only "on
// brand" if every text/background pairing actually used in layouts/ clears
// its threshold — this replaces eyeballing with a formula, the same
// principle the dataviz skill applies to chart palettes.
// Exit 0 = every theme's pairs pass their role's threshold. Exit 1 = any fail.
import fs from 'node:fs';
import path from 'node:path';

const TOKENS_PATH = path.resolve(process.cwd(), 'brand/tokens.css');

const LARGE_TEXT_MIN = 3.0; // WCAG AA, large-scale text (~24px+/bold ~19px+)
const NORMAL_TEXT_MIN = 4.5; // WCAG AA, normal text

// Keep in sync with brand/tokens.css's [data-theme="..."] blocks and
// render.mjs's THEMES list.
const THEMES = ['slate', 'forest', 'copper'];

// Every foreground/background combination actually used by layouts/*, read
// off brand/tokens.css by custom-property name. Keep this list in sync with
// tokens.css whenever a layout introduces a new color combination — this
// script only knows what it's told to check.
const PAIRS = [
  ['--color-ink', '--color-bg', 'normal', 'body text on light sections'],
  ['--color-ink-inverse', '--color-bg-inverse', 'normal', 'section-divider / closing headline'],
  ['--color-muted', '--color-bg', 'normal', 'captions, subtitles, muted labels'],
  ['--color-accent', '--color-bg', 'normal', 'agenda numerals, quote marks, big-stat'],
  ['--color-accent', '--color-accent-soft', 'large', 'comparison column headings'],
  ['--color-accent-on-dark', '--color-bg-inverse', 'normal', 'section-divider label'],
  ['--color-accent-on-dark', '--color-bg-inverse', 'large', 'closing CTA'],
];

function parseThemeBlock(css, themeName) {
  const re = new RegExp(`\\[data-theme="${themeName}"\\][^{]*\\{([^}]*)\\}`);
  const m = re.exec(css);
  if (!m) return null;
  const tokens = {};
  const tokenRe = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let t;
  while ((t = tokenRe.exec(m[1]))) tokens[t[1]] = t[2];
  return tokens;
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const num = parseInt(h.slice(0, 6), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255].map((v) => v / 255);
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const [hi, lo] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

function main() {
  const css = fs.readFileSync(TOKENS_PATH, 'utf8');
  let failed = false;

  for (const theme of THEMES) {
    const tokens = parseThemeBlock(css, theme);
    console.log(`Contrast check — theme "${theme}":\n`);
    if (!tokens) {
      console.error(`error: no [data-theme="${theme}"] block found in brand/tokens.css`);
      failed = true;
      continue;
    }
    for (const [fgName, bgName, role, where] of PAIRS) {
      const fg = tokens[fgName];
      const bg = tokens[bgName];
      if (!fg || !bg) {
        console.error(`error: unknown token in pair [${fgName}, ${bgName}] — update PAIRS to match tokens.css`);
        failed = true;
        continue;
      }
      const ratio = contrastRatio(fg, bg);
      const min = role === 'large' ? LARGE_TEXT_MIN : NORMAL_TEXT_MIN;
      const pass = ratio >= min;
      if (!pass) failed = true;
      console.log(
        `  [${pass ? 'PASS' : 'FAIL'}] ${fgName} on ${bgName} (${role} text — ${where}): ${ratio.toFixed(2)}:1, needs ${min}:1`
      );
    }
    console.log('');
  }

  console.log(
    failed ? 'FAILED — fix the marked pairs before shipping this palette.' : 'All themes pass WCAG contrast for every role.'
  );
  process.exit(failed ? 1 : 0);
}

main();
