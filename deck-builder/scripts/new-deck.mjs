#!/usr/bin/env node
// Scaffolds decks/<slug>/deck.yaml with a minimal skeleton (title -> one
// assertion-evidence slide -> closing) ready to be filled in.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { title: null, slug: null, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--title') args.title = argv[++i];
    else if (argv[i] === '--slug') args.slug = argv[++i];
    else if (argv[i] === '--force') args.force = true;
  }
  return args;
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function main() {
  const { title, slug: slugArg, force } = parseArgs(process.argv.slice(2));
  if (!title) {
    console.error('Usage: node scripts/new-deck.mjs --title "My Deck" [--slug my-deck] [--force]');
    process.exit(1);
  }
  const slug = slugArg || slugify(title);
  const deckDir = path.join(REPO_ROOT, 'decks', slug);
  const deckPath = path.join(deckDir, 'deck.yaml');

  if (fs.existsSync(deckPath) && !force) {
    console.error(`${deckPath} already exists (use --force to overwrite)`);
    process.exit(1);
  }

  fs.mkdirSync(deckDir, { recursive: true });

  const skeleton = `title: "${title}"
objective: "" # what the audience should believe/do differently after this talk
audience: "" # who's in the room, how technical they are
slides:
  - layout: title
    title: "${title}"
    subtitle: ""
    author: ""
    date: "${new Date().toISOString().slice(0, 10)}"

  - layout: assertion-evidence
    headline: "State the one claim this slide makes."
    evidence:
      type: image
      src: ""
      alt: ""
    notes: "Detail, caveats, and sources go here — not on the slide."

  - layout: closing
    headline: "Restate the deck's core assertion."
    cta: "What you want the audience to do next."
`;

  fs.writeFileSync(deckPath, skeleton, 'utf8');
  console.log(`Created ${deckPath}`);
  console.log(`Next: npm run validate -- ${path.relative(REPO_ROOT, deckPath)}`);
  console.log(`Then: npm run render -- ${path.relative(REPO_ROOT, deckPath)}`);
}

main();
