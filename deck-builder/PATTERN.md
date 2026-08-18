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

## 2. The six rules

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
6. **One metaphor slide grounds newcomers.** Every deck includes exactly one
   metaphor-mapping slide: borrow a concrete, everyday domain that shares
   the deck's actual structure, and map each key concept onto its analog
   there. This is a different move from the `decompose`-driven grounding
   slide in the process below — that one decomposes the *real* subject into
   its own real pieces; this one substitutes a familiar frame the audience
   already has intuition for, precisely because the real subject doesn't
   come with one built in. Domain is chosen by structural fit *and* audience
   fit, not a fixed list — start from the deck's structural shape, then pick
   whatever concrete domain in that shape's family will actually land with
   the stated `audience`:
   - Flat, unordered grouping (a fixed number of buckets decided up front)
     → e.g. a **kitchen/pantry** sort, a **farm** sorting produce into bins,
     a **sports draft** assigning players to fixed roster slots.
   - Nested/hierarchical structure (small pieces merge upward, or one whole
     splits downward) → e.g. a **library**'s card-catalog/Dewey-Decimal
     tree, a **family tree**, a **corporate org chart**.
   - Ordered sequence or process (steps, phases, cause leading to effect)
     → e.g. a **historical narrative**, a **road trip**, an **assembly
     line**, a **sports season**.
   - Interacting/interdependent parts (each piece needs the others to work)
     → e.g. a **car engine**, a **sports team's positions**, a **kitchen
     brigade** (line cook / sous chef / expediter).
   - None of the above fit cleanly → pick the nearest analog for the shape
     that's actually there, and say why in the slide's `notes`, rather than
     forcing a bad fit.
   These categories are examples of each shape's family, not an exhaustive
   menu — the test is "does this domain's own structure match the deck's,
   and would this specific audience recognize it fast," not "is it one of
   the ones listed here."
   Domain selection is not a silent, single-shot pick — propose 2-3
   candidate domains from the applicable family, each with a one-line
   reason it fits this deck's shape and this specific audience, and get the
   user's pick before mapping concepts onto it. If a candidate's real-world
   mechanics matter to the mapping (e.g. an assembly line's actual station
   order, a kitchen brigade's actual reporting structure) and aren't
   something you're confident about, verify them before offering the
   candidate — a metaphor built on a wrong mental model misleads the
   audience worse than no metaphor at all. This mirrors the objective/
   audience interview at the top of the process: cheap to pause on before
   the mapping exists, expensive to unwind after callback lines (and, if
   full integration is used, reskinned evidence) have been written into
   every later slide.
   Placed after `agenda` (or after `title` if the deck has no agenda) and
   before the first content section — the audience gets the roadmap, then
   the mental model to hang it on, then the content itself. The mapping
   isn't a tenth layout: classify it like any other content, most often
   `comparison` (2-4 named things being mapped, one column per thing) or
   `assertion-evidence` with a table (a single mechanism, one row per
   concept).

   **Every slide gets at least a spoken callback — the default lives in
   `notes`, never the headline.** Once the metaphor slide has established
   the mapping, every later slide gets a one-line callback: a `Delivery:`
   line in that slide's `notes` the presenter says aloud (e.g. "this is the
   host's seating chart, formalized"). The headline stays the real
   technical claim per rule 1 in every case, full integration or not — a
   headline reading "K-Means sorts records into a fixed number of segments"
   must keep saying that, or the deck loses the actual assertion the
   audience needs to walk away with. Slides with nothing natural to hook
   (a tooling comparison, a pure logistics timeline) don't need to strain
   for a callback — a one-line, explicit retirement of the metaphor ("the
   metaphor's done its job — here's what you'll actually click") is a
   better move than forcing it, and is itself part of giving the motif a
   deliberate arc rather than an abrupt drop.

   **Full integration — evidence and caption carry the metaphor too — is
   available for the slides the metaphor slide itself mapped, at the
   deck author's discretion.** Beyond the baseline callback, a slide
   teaching one of the metaphor's directly-mapped concepts may also reskin
   its **evidence** (same underlying technical diagram — same data shape,
   same structure — restyled with the metaphor's imagery and labels) and
   blend its **caption** (technical term paired with the metaphor term,
   e.g. "Nearest-centroid assignment — the host's 'nearest table,'
   reshuffled until it settles"). This is heavier authoring investment than
   the baseline callback, so treat it as a deliberate per-deck choice, not
   a default every deck must reach for. Two guardrails keep it from
   sliding into the anti-slop failure mode (§7, cute framing standing in
   for substance):
   - The headline is exempt even here — see above.
   - **Evidence standing in for real-world data stays literal, never
     reskinned.** A slide illustrating an actual population (real vendor
     payments, real access logs — not the technique's own teaching
     example) keeps its literal evidence even in a fully-integrated deck.
     Costuming a stand-in for real data as party imagery blurs "this is
     illustrative real data" into "this is more metaphor" — precisely the
     assertion-match failure `review-evidence` (§8) exists to catch. Those
     slides still get the baseline spoken callback, just not a reskinned
     image.

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
| `comparison` | Content is 2-3 named options/items being weighed side by side. | `columns: [{heading, points: [string], icon?}]`, `notes` |
| `timeline` | Content is ordered steps, phases, or dates. Steps are connected by a default chevron between each pair — sequence is the point (see below). | `steps: [{label, detail, icon?}]`, `notes` |
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

### Optional per-slide icon

Any slide, on any layout, may set an `icon` field — a relative path to a
small line-icon SVG in the deck's own `assets/` folder (e.g.
`assets/icon-plane.svg`), rendered as a low-opacity topical accent in the
slide's corner. This is author opt-in per slide, never automatic — most
slides don't need one; reach for it when a slide's real content (a table,
a metaphor mapping, a claim) has an obvious concrete object behind it and
nothing else on the slide is already carrying that visual (an
`assertion-evidence` slide whose evidence is already a diagram doesn't
usually need one too).

- **Sourcing**: vendor the icon from a permissively-licensed open set
  (Lucide, ISC — the one used so far) rather than hand-drawing one-off
  icons or linking a CDN/icon font. Fetch the raw SVG (e.g.
  `https://unpkg.com/lucide-static@latest/icons/<name>.svg`), save it into
  the deck's `assets/` folder with a `# vendored from ...` comment noting
  the source and license, and reference it via `icon:`. This keeps the
  rendered deck fully self-contained (no runtime CDN dependency for the
  icon, same as evidence diagrams) while still drawing on a real,
  professionally-drawn icon library instead of ad hoc line art.
- **Selection is a research-and-approval checkpoint, the same pattern as
  metaphor domain selection (rule 6 below)**: propose 2-4 candidate icons
  that fit the slide's content, show the user a visual preview at deck
  scale/color (an Artifact gallery works well for this), and get their
  pick before wiring one in — don't silently choose one. Icon *scope*
  (just this one slide, vs. adding icons to several slides) is also worth
  confirming rather than assuming, the first time in a given deck.
- **Rendering**: `scripts/render.mjs` inlines the SVG's raw markup (not a
  data-URI `<img>`) into a `.slide-icon` wrapper injected right after the
  slide's opening `<section>` tag — this works uniformly across every
  layout without touching each layout's own template file. Inlining
  (rather than an `<img>`) is what lets the icon's `stroke="currentColor"`
  pick up `--color-accent` via `.slide-icon`'s `color`, the same trick
  `brand-corner-mark` uses for the logo, so it responds to the runtime
  theme toggle automatically.
- **Anti-slop guardrail**: keep it low-opacity background texture (`brand/
  tokens.css`'s `.slide-icon` ships at `opacity: 0.1`), never a bold
  foreground graphic — an icon competing with the slide's real evidence
  for attention is exactly the decorative-filler failure mode rule 7
  warns about. One icon per slide at most; this is deliberately not a
  blanket per-slide default the way the brand corner mark is.

### Optional badge icon (comparison/timeline)

A second, independent icon pattern from the per-slide icon above — not a
variant of it, and answering a different question. The per-slide icon is
low-opacity background texture for *one* slide; a badge icon is a small,
full-opacity marker for a **recurring category** — the same named thing
(a technique, a phase) that reappears across two or more `comparison`
columns or `timeline` steps in the same deck. Set it via that column's or
step's own `icon` field (`columns: [{heading, points, icon}]`, `steps:
[{label, detail, icon}]`) — same relative-path-into-`assets/` convention as
every other icon/evidence field.

- **Rendering**: `scripts/render.mjs` inlines the SVG (same `resolveIconMarkup`
  trick as the per-slide icon, for the same `currentColor` reason) into a
  `<span class="icon-badge">` prepended inside that column's `<h3>` or that
  step's `.label`. `brand/tokens.css`'s `.icon-badge` renders it as a small
  filled circle: `--color-accent-soft` background, `--color-accent` icon,
  **full opacity** — unlike the per-slide icon's 0.1, because this icon
  carries real meaning rather than being pure decoration. A meaningful icon
  needs to clear WCAG's 3:1 contrast floor and can never be the sole
  signal (WCAG G207) — a badge always sits inline next to its category's
  own text label, never alone.
- **No new contrast-check entry needed**: `--color-accent` on
  `--color-accent-soft` is already in `scripts/check-contrast.mjs`'s
  `PAIRS` list (comparison column headings use the same combination) and
  passes. Re-run `npm run check-contrast` after adding a badge to confirm
  rather than assume, the same as any other color-token change.
- **The rule that makes this wayfinding instead of decoration: a recurring
  category reuses the same icon file everywhere it appears in the deck.**
  `validate-deck.mjs` checks this mechanically — it warns if the same
  column heading or step label is seen with two different icon paths
  anywhere in the deck.
- **Selection is the same research-and-approval checkpoint** as the
  per-slide icon and the metaphor domain pick — propose candidates, preview
  at real size/color, get the user's pick before wiring in. `.claude/skills/
  select-icons/SKILL.md` in this repo owns this process for both icon
  patterns; `make-deck` invokes it as a step.
- Only worth proposing when a deck actually has 2+ recurring named
  categories spanning multiple `comparison`/`timeline` slides — not for
  one-off content, and not on `agenda` (which already has its own numeral
  motif; adding a second one there would violate the anti-slop "one
  repeated motif" rule in §7).

### Timeline connector

`timeline` steps render with a small chevron (`›`) in the gap after every
step but the last — a pure-CSS border arrow in `brand/tokens.css`
(`.layout-timeline .step::after`), not a separate icon or asset. This is
the layout's own default, not a per-deck opt-in: a timeline's whole reason
for existing is that order matters (see the layout's classification rule),
so the path between steps is drawn rather than left implied by a bare
numbered row. No `deck.yaml` field controls this — it always renders when
a `timeline` slide has more than one step.

**Do not set `position` on `.reveal .slides section` in `tokens.css`.**
reveal.js's own stylesheet already sets `position: absolute` there — that
positioning is load-bearing for reveal's slide-stacking/navigation
mechanism. Overriding it (even to `relative`, which seems harmless)
silently breaks `Reveal.slide()`/keyboard navigation: slides past the
first stop being laid out at their intended position. `.slide-icon` above
anchors correctly against that existing positioned ancestor without any
extra rule — confirmed via `Reveal.getCurrentSlide().getBoundingClientRect()`
showing a "present" slide stuck off-canvas before this was reverted.

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
- **Visual rhythm**: `validate-deck.mjs` warns on 4 or more consecutive
  content slides with no independent visual weight — no image/diagram
  evidence, no icon, and not one of the layouts whose own shape is already
  a visual break (`big-stat`, `comparison`, `timeline`, `quote`). This is
  based on attention-curve research: audience attention drops off over a
  *stretch* with no visual variety, not because of any single slide's
  content, so the check looks at the sequence rather than one slide in
  isolation. `title`/`agenda`/`section-divider`/`closing` reset the streak,
  since each already reads as its own visual break. The fix is a per-slide
  icon, a restructure into one of the inherently-visual layouts, or real
  evidence on one of the flagged slides — not suppressing the warning.
  `.claude/skills/select-icons/SKILL.md` is the process that acts on this
  warning.

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

### Inline notes toggle (solo-review, off by default)

Pressing "N" calls `Reveal.configure({ showNotes: true })` at runtime,
which renders each slide's notes directly on the page — no popup window,
unlike "S" (speaker view, via the Notes plugin's `window.open()`, which
some browsers/settings block outright). This exists specifically for
reviewing a deck solo, where waiting on a popup is friction, not a
feature. It defaults to **off** and stays a keypress, not an on-screen
control (same anti-slop reasoning as the theme toggle above) — a deck
actually being projected to a live audience still relies on "S" alone, so
notes never appear on the shared screen unless "N" is deliberately
pressed. Don't change the default to `true`; that would put presenter-only
content (caveats, delivery cues) in front of every audience by default,
undoing the separation rule 3 documents.

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
