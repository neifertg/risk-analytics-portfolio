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

## The example deck: Anomaly Detection for Internal Audit

`decks/anomaly-detection-for-internal-audit/` is a real internal-training
deck — 16 slides walking staff through four anomaly-detection techniques
(Isolation Forest, Local Outlier Factor, One-Class SVM, Autoencoders),
each mapped to a single running metaphor (an airport security checkpoint)
so the "same job, different mechanism" framing carries across the whole
deck instead of resetting per slide, and closing on a concrete first pilot
staff can actually run this quarter. Built from the anomaly-detection
resource notes in my personal AI/ML learning wiki.

A second real deck, `decks/clustering-for-audit/` (17 slides on K-Means,
Hierarchical Clustering, DBSCAN, and Gaussian Mixture Models), is also
committed here and builds/renders the same way — not currently the
featured example, but worth a look for a second data point on the same
layout set.

**[Open the live deck](decks/anomaly-detection-for-internal-audit/index.html)**
— click through with arrow keys or on-screen controls.

## Running it

```bash
npm install
npm run validate -- decks/anomaly-detection-for-internal-audit/deck.yaml
npm run render -- decks/anomaly-detection-for-internal-audit/deck.yaml
npm run check-contrast
```

`render` writes `decks/anomaly-detection-for-internal-audit/index.html`
(already committed here, so the live link above works without a build
step) and prints a reminder that pressing "T" while presenting cycles
between three WCAG-checked color themes (slate/forest/copper), and "N"
toggles inline speaker notes for solo review.

`npm run new-deck -- --title "My Deck" --slug my-deck` scaffolds a new
`deck.yaml` against the same layout set.
