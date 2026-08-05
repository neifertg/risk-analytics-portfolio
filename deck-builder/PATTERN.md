# The pattern

This document is the design spec both humans and the `make-deck` skill
follow. It exists so "make this deck look good" is a checklist, not a
vibe. If you change the layout set or the render pipeline, update this file
in the same change — it must never drift from what the code actually does.

## 1. Why these rules (research basis)

- **Assertion-Evidence structure** (Michael Alley, Penn State; used widely
  in technical/academic presenting): every slide states one assertion as a
  complete sentence headline, then supports it with one piece of visual
  evidence — a photo, diagram, chart, or number — instead of a bullet list.
  Audiences comprehend and retain assertion-evidence slides better than
  bullet-and-topic-phrase slides, because the visual and verbal channels
  each carry a coherent, non-redundant signal instead of the speaker
  reading the slide aloud.
- **Nancy Duarte, *slide:ology***: contrast, flow, hierarchy, unity,
  proximity, and whitespace are the tools that make a viewer's eye land on
  the right thing first. One idea per slide is non-negotiable — a
  multi-part concept is multiple slides, not one busy one.
- **Guy Kawasaki's 10/20/30 rule**: text density and slide count are a
  budget, not a formatting afterthought. The version of this rule that
  matters here isn't "exactly 10 slides" — it's the underlying logic: an
  audience can hold a handful of ideas per sitting, so cut content before
  you shrink text.
- **Layout taxonomy** (standard presentation-design practice, e.g. Duarte
  slidedocs, mainstream deck-design guides): professional decks draw from a
  small, consistent vocabulary of layout types — title, agenda, comparison,
  timeline, quote, section divider — capped at roughly 3-5 types actually
  used in any one deck. Reusing a small set of layouts is itself part of
  what makes a deck read as "designed" rather than "assembled."

## 2. The five rules

1. **One assertion per slide.** The headline is a complete, plain sentence
   stating a claim — not a topic label ("Q3 Results") and not a fragment.
   If a slide needs "and" to join two claims, it's two slides.
2. **Evidence, not bullets.** Every content slide's proof is one visual:
   an image, diagram, chart, number, or short table — never a bullet list
   standing in for the speaker's explanation. If the only evidence you have
   is a list of words, that's a sign the assertion is still too abstract —
   sharpen it until there's something to show.
3. **Detail lives in speaker notes — and so does delivery guidance.** The
   slide carries the claim and the proof; everything else goes in that
   slide's `notes` field, rendered as reveal.js speaker notes (visible only
   to the presenter, via the "s" key), never as extra on-slide text. `notes`
   does two distinct jobs, and both belong there: **reference material**
   (caveats, numbers behind the number, sources) and **delivery guidance**
   (a verbal bridge into the next slide, a pacing/emphasis cue, a moment to
   pause or ask the room a question). Every layout supports `notes`,
   including `title`, `agenda`, `section-divider`, and `quote` — a talk
   needs opening remarks and transition cues as much as a content slide
   needs its sources. Skipping delivery guidance entirely and only using
   `notes` for reference material is a common half-measure: technically
   correct, but leaves a presenter with no more help running the talk than
   the slide text alone already gives them.
4. **Layout is classified, not chosen.** Every slide's content is mapped to
   exactly one of the nine layouts below by what shape the content already
   has. Don't invent a one-off layout for a single deck — if content
   doesn't fit the taxonomy, restructure the content, or propose a
   deliberate addition to this document.
5. **Brand is structural.** Color, type scale, and spacing come only from
   `brand/tokens.css`. Contrast/hierarchy/whitespace (Duarte's tools) are
   encoded once, there, so every layout inherits them automatically instead
   of each layout re-deciding what "looks good" means.

## 3. Layout taxonomy

The classification a piece of content goes through, in order — first match
wins:

| Layout | Selection rule | Fields |
|---|---|---|
| `title` | Always slide 1. | `title`, `subtitle`, `author`, `date`, `notes` |
| `agenda` | Deck has 3+ named sections **and** totals more than ~8 slides. Skipped for short/pitch decks — a 6-slide deck doesn't need a map. | `items: [string]`, `notes` |
| `section-divider` | Content marks a narrative pivot to a new part/act, not a claim itself. | `label` (e.g. "Part 1"), `title`, `notes` |
| `assertion-evidence` | Default. Anything that is a claim + something to show. This is the workhorse — most slides land here. | `headline`, `evidence: {type: image\|diagram\|table, src, alt}`, `notes` |
| `big-stat` | The headline fact reduces to a single number or metric. | `stat`, `context`, `notes` |
| `comparison` | Content is 2-3 named options/items being weighed side by side. | `columns: [{heading, points: [string]}]`, `notes` |
| `timeline` | Content is ordered steps, phases, or dates. | `steps: [{label, detail}]`, `notes` |
| `quote` | Content is a verbatim attributed statement. | `quote`, `attribution`, `notes` |
| `closing` | Always the last slide. Recaps the deck's core assertion + a call to action. | `headline`, `cta`, `notes` |

Every layout supports `notes` (see rule 3 above) — `scripts/render.mjs`
wires `notesHtml` into all nine layout templates as of 2026-08-03; before
that, `title`, `agenda`, `section-divider`, and `quote` silently dropped a
`notes` field if one was authored, since the renderer never substituted it
into those four templates. If you're looking at an older deck and a
`notes:` value on one of those four layouts doesn't show up in speaker
view, re-run `render.mjs` — the content in `deck.yaml` was never lost, it
just wasn't being rendered.

`evidence.src` for `image`/`diagram` may be a relative path (resolved against
that deck's own directory, e.g. `decks/<slug>/assets/kmeans.svg`), an
external URL, or a data URI. A relative path is embedded as a base64 data
URI at render time (`scripts/render.mjs`'s `resolveEvidenceSrc`) so the
rendered `index.html` stays a single self-contained file — decks never
depend on relative file paths surviving being moved, emailed, or opened
from a different folder.

Classification heuristics for the skill (in priority order — evaluate each
slide-candidate content unit against these before defaulting to
assertion-evidence):

1. Is this the first/last unit of content? → `title` / `closing`.
2. Is this introducing a new named part of the talk (not a claim)? →
   `section-divider`.
3. Does the deck have 3+ sections and need a map, and is this that map? →
   `agenda`.
4. Is the single most important fact here a number? → `big-stat`.
5. Are there 2-3 named things being weighed against each other? →
   `comparison`.
6. Is this an ordered sequence of steps/dates/phases? → `timeline`.
7. Is this a verbatim quote with an attribution? → `quote`.
8. Otherwise → `assertion-evidence`.

### Top-level deck fields

Every `deck.yaml` has `title` (required) and `slides` (required). Two more
are optional but strongly recommended:

- `objective` — what the audience should believe or do differently after
  the talk (the `make-deck` interview's first question).
- `audience` — who's in the room and how technical they are.

Neither renders on any slide — they exist so the deck's stated intent
survives past the conversation that produced it. §8's evidence-review step
reads them to judge whether a slide's evidence actually fits the audience
and serves the objective; a reviewer working in a fresh context has nothing
to check evidence against without them.

## 4. Density and slide-count guardrails

- Headline text: aim for tweet-length (~90 characters), hard cap enforced
  by `validate-deck.mjs` at 140.
- Body/supporting text per slide (outside the headline): a few words, not
  sentences — the assertion-evidence slide's text budget is the headline
  plus at most one short caption on the evidence.
- Slide count: `validate-deck.mjs` emits a **warning** (not a hard failure)
  above 15 content slides (excluding `title`/`section-divider`/`closing`).
  The fix is to cut or split into multiple decks, not to shrink text or
  suppress the warning.
- Font size: `brand/tokens.css` sets the base slide type scale so body text
  renders at a 30pt-equivalent size at 1920x1080 — don't override
  font-size locally in a layout to fit more text.
- Table evidence (`evidence: {type: table}`) follows the same density rule
  as headlines: each cell is a short phrase (aim ~40-60 characters), not a
  sentence. A table of full-sentence explanations is a bullet list wearing a
  table's clothes, and violates rule 2 (evidence, not bullets) even though
  it technically satisfies the schema. `validate-deck.mjs` warns above 70
  characters per cell.
- Image/diagram evidence (`evidence: {type: image|diagram}`) should target a
  **landscape aspect ratio of roughly 1.3:1 to 2:1**. `.evidence`'s box is
  wide-and-short (the headline and optional caption eat vertical space, not
  horizontal), and the image is capped at 75% of that box on both axes,
  preserving its own aspect ratio — a near-square or portrait diagram ends
  up height-capped with wasted space on either side; a very wide one ends up
  width-capped with wasted space above and below. `validate-deck.mjs` warns
  outside ~1.1-2.4:1 for local SVG/PNG evidence files.
- The renderer always turns a table's first row into a bolded `<thead>` —
  give it a genuine header (e.g. `["Aspect", "In practice"]`) that names
  what the columns mean, rather than letting whichever fact happens to come
  first get arbitrary visual emphasis.

## 5. Brand tokens

`brand/tokens.css` defines (as CSS custom properties, consumed by every
file in `layouts/`):
- `--color-bg`, `--color-ink`, `--color-accent`, `--color-accent-on-dark`,
  `--color-muted`
- `--font-family` (system stack; swap for a real brand font later)
- `--font-scale-headline`, `--font-scale-body`, `--font-scale-stat`
- `--space-unit` (base spacing unit; all layout padding/margins are
  multiples of it)
- `--logo-url` (points at `brand/logo-placeholder.svg`; swap the file, not
  the layouts, when real branding arrives)

`--color-accent` is calibrated against the light background; on the dark
sections (`section-divider`, `closing`) use `--color-accent-on-dark`
instead — the same hue lightened enough to clear WCAG contrast against
`--color-bg-inverse`. A single accent value cannot pass 4.5:1 against both
a light and a dark surface at once (verified: the original single-accent
`--color-accent` measured 2.97:1 on `--color-bg-inverse`, below even the
3:1 large-text floor). Run `npm run check-contrast` (`scripts/check-contrast.mjs`)
after touching any color in this file — it checks every foreground/background
pair actually used in `layouts/` against WCAG AA (4.5:1 normal text, 3:1
large-scale text) and fails loudly instead of letting a bad pairing ship.
Any new color combination introduced in a layout must be added to that
script's `PAIRS` list in the same change.

Placeholder values are deliberately generic-but-clean (dark ink on light
background, one accent color) so a deck built today already looks
intentional, and swapping to a real brand later is a one-file change.

### Dark-surface layouts use the `.dark` modifier, not their own background

`.reveal .slides section` (the base rule every slide matches) has higher
CSS specificity than a bare single-class selector like
`.layout-section-divider` — so a layout that tries to set its own
`background`/`color` directly (as `section-divider` and `closing` once did)
silently loses to the base rule regardless of source order. The symptom
looked exactly like a color-contrast bug (near-white text on what should've
been a near-black background actually rendered on the light background
instead — "light grey on white") but no accent-token tweak could have
fixed it, because the dark background itself was never applying.

The fix: any layout needing the dark surface adds `class="dark"` in its
`layouts/*.html` template (see `section-divider.html`, `closing.html`), and
`.reveal .slides section.dark { background: var(--color-bg-inverse); color:
var(--color-ink-inverse); }` — already defined, matching the base rule's
specificity plus one class — provides it. Don't declare `background` or
`color` directly on a layout's own class for this purpose; it will not win.

### Color themes (presenter-facing runtime toggle)

`brand/tokens.css` ships three named accent themes as `[data-theme="..."]`
blocks (`slate` default, `forest`, `copper`). Every rendered deck embeds all
three plus a small script (`render.mjs`) that cycles
`document.documentElement.dataset.theme` when the presenter presses "T" — no
on-screen control, per the anti-slop no-decorative-chrome rule below. This
is a presentation-time choice, not a `deck.yaml` field; a deck author never
picks a theme, a presenter does, live.

Rules for adding or changing a theme:
- **Only the accent triad varies** (`--color-accent`, `--color-accent-on-dark`,
  `--color-accent-soft`). `--color-bg`, `--color-bg-inverse`, `--color-ink`,
  `--color-ink-inverse`, and `--color-border` stay identical across every
  theme — this is what keeps every theme high-contrast and prevents a
  theme from reintroducing the beige/cream-background anti-pattern in §7.
- A new theme must pass `npm run check-contrast` before it ships (add its
  name to the `THEMES` list in both `scripts/check-contrast.mjs` and
  `scripts/render.mjs`, alongside its `[data-theme="..."]` block in
  `tokens.css`). Don't hand-pick an accent hue and skip the check — the
  slate/forest/copper values were chosen by testing candidates against the
  formula, not by eye.

## 6. Non-goals

- Not a general-purpose slide editor — there's no WYSIWYG, no drag-and-drop.
  `deck.yaml` is the interface.
- Not trying to support every possible slide idea. If content doesn't fit
  the nine layouts, that's a signal to simplify the content, not a bug in
  the taxonomy.

## 7. Anti-slop guardrails

- Avoid decorative edge stripes, title underlines, or color bars as a default
  visual motif. These accents are a common tell of formulaic or AI-generated
  slide styling.
- Avoid default cream or beige backgrounds as a fallback branding shorthand.
  Prefer the repo's current high-contrast base palette and a single branded
  accent color held at roughly 60–70% visual weight.
- Commit to one repeated visual motif across the deck: one accent color,
  one typographic treatment, or one consistent data style. Don't mix equal-
  weighted decorative treatments across slides.
- Keep title and section treatments simple. Don't add decorative separators or
  underlines that compete with the content.

## 8. Evidence review

`validate-deck.mjs` catches structural problems (missing fields, headline
length, unresolved paths, aspect ratio). It cannot catch whether a piece of
evidence is *right* — whether the diagram actually shows what the headline
claims, whether it's worth including at all, or whether it fits the
audience. That needs judgment, applied by a reviewer who didn't design the
evidence and so doesn't share the designer's blind spots. `.claude/skills/
review-evidence/SKILL.md` in this repo runs that check via an independent
subagent; this section is the checklist it (and any human reviewer) applies.

Concrete case that motivated this: a six-piece ecosystem diagram was built
with `LangGraph` at the visual center, while its own slide's headline read
"langchain-core defines one shared shape so every piece can plug in" — the
diagram's actual hub didn't match the claim's subject. The mismatch existed
from the first draft and passed an in-context self-review, because the
reviewer and the designer were the same reasoning in the same breath.

| Dimension | Good | Bad |
|---|---|---|
| **Assertion match** | The evidence's most visually prominent element is the thing the headline is actually about; drawn relationships match claimed relationships. | Headline claims X is central/primary; the evidence's visual hierarchy foregrounds Y instead. |
| **Value-add** | Cover the evidence, re-read the headline + caption — the evidence still teaches something they don't (a structure, a proportion, a relationship). | Evidence is decorative filler; deleting it loses no information a reader had. |
| **Accuracy** | Every relationship or fact the evidence implies traces back to the source material it was built from. | Evidence invents a dependency, trend, or fact the source never stated. |
| **Coherence** | Same visual motif/color convention as sibling evidence slides; complexity matches the deck's stated `audience`. | Each evidence slide invents its own unrelated visual language, or assumes technical background the stated audience doesn't have. |
| **Technical craft** | Legible at deck scale, correct aspect ratio, nothing clipped or overlapping, sensible information density. | Text/shapes bleed off the canvas edge; or (see `progress.md`'s DBSCAN case) two diagrams share an identical box but wildly different ink density, so one reads as "wrong size" even though the box itself is correct. |
