# Presentation Deck Builder

A generator for branded, on-pattern reveal.js slide decks — built for
producing internal-audit training and briefing material quickly, without
every deck reinventing its own layout and design choices from scratch.

## How it works

Content goes in as an intent-based `deck.yaml` — a list of slides, each
tagged with a layout (title, agenda, section-divider, assertion-evidence,
comparison, big-stat, timeline, quote, closing) and its content, never raw
HTML. `scripts/render.mjs` turns that into a self-contained HTML file using
the shared layouts and brand tokens in this repo, so every deck built with
it looks consistent without hand-tuning CSS per deck. `scripts/validate-deck.mjs`
checks structural rules before rendering — headline length, one assertion
per slide, evidence-image aspect ratio, a slide-count guardrail — so a
malformed deck fails fast instead of rendering something broken.

Day to day, this is driven by a Claude Code skill (`make-deck`) that authors
the `deck.yaml` from a rough outline or a set of source notes. It also works
by hand: write a `deck.yaml`, run `validate`, run `render`.

## The example deck: Clustering for Audit Analytics

`decks/clustering-for-audit/` is a real internal-training deck — 17 slides
walking through K-Means, Hierarchical Clustering, DBSCAN, and Gaussian
Mixture Models, each framed as an audit question ("which segment doesn't
look like the rest," "which account doesn't match its peers") rather than
as abstract ML theory. Built from the clustering resource notes in my
personal AI/ML learning wiki, with two worked audit examples (vendor-payment
clustering, access-log clustering) added specifically for this deck.

**[Open the live deck](decks/clustering-for-audit/index.html)** — click
through with arrow keys or on-screen controls.

## Honest gaps

Two known, low-priority cosmetic issues carried over from the deck's build
history, neither fixed here since they don't affect readability:

- No automated check yet catches a contrast problem baked into an SVG
  diagram's own colors (as opposed to the page's CSS, which *is* checked
  by `scripts/check-contrast.mjs`) — a manual pass caught and fixed this
  once already; it isn't mechanically enforced.
- One diagram's rounded-rect card border renders twice (once from the SVG
  asset, once from the surrounding CSS) — visually harmless, not fixed.

## Running it

```bash
npm install
npm run validate -- decks/clustering-for-audit/deck.yaml
npm run render -- decks/clustering-for-audit/deck.yaml
```

`render` writes `decks/clustering-for-audit/index.html` (already committed
here, so the live link above works without a build step) and prints a
reminder that pressing "T" while presenting cycles between three
WCAG-checked color themes (slate/forest/copper).

`npm run new-deck -- --title "My Deck" --slug my-deck` scaffolds a new
`deck.yaml` against the same layout set.
