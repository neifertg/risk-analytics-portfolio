# Audit Procedures RAG Assistant

[![CI](https://github.com/neifertg/risk-analytics-portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/neifertg/risk-analytics-portfolio/actions/workflows/ci.yml)

![Audit Procedures RAG Assistant answering a question with cited sources and per-session cost tracking](../assets/audit-rag-assistant-demo.png)

A retrieval-augmented question-answering assistant grounded in a synthetic
internal-audit procedures corpus — chunk → embed → retrieve → generate,
with a groundedness guardrail and query logging. No orchestration
framework, no agent loop: the mechanics stay visible on purpose.

This is a port of a personal-wiki project
([Seth_Wiki](https://github.com/neifertg/seth-wiki), private) onto a
corpus that's actually safe to publish — the retrieval/generation
pipeline is unchanged; only the content it runs against is new.

## Why a synthetic corpus

Real audit-standards text (IIA/COSO frameworks) is copyrighted; real SEC
filings or GAO reports would have worked but needed real curation effort
this port didn't need to spend to make the point. The 20 procedure
documents in `corpus/` are self-written, covering a real internal-audit
curriculum: fieldwork-level testing (SOX 404 testing, sampling
methodology, vendor/expense/access controls, revenue recognition,
segregation of duties, journal entry testing, inventory observation,
contract compliance, procurement/PO matching, IT change management,
data privacy) and department-level governance (risk assessment,
enterprise risk management/risk appetite, whistleblower hotline
handling, third-party vendor risk, business continuity/disaster
recovery, audit committee reporting) — plausible, not authoritative.
Don't cite this corpus as real audit guidance.

## Architecture

```
corpus/*.md  →  chunk.mjs  →  embed.mjs (Voyage voyage-3-lite)  →  index/store.json
                                                                          │
question  →  search.mjs (two-stage retrieval)  ───────────────────────┘
                    │
                    ▼
         guardrail: top-chunk similarity < threshold?
             │ yes                          │ no
             ▼                              ▼
      decline, no generation call    answer.mjs → Anthropic (claude-haiku-4-5)
             │                              │
             └──────────────┬───────────────┘
                             ▼
                    logs/queries.jsonl (observability)
```

Retrieval is two-stage: a coarse pass ranks each document's summary
embedding to shortlist candidates, then a finer pass ranks that subset's
section-level chunks. A diversity cap (`MAX_CHUNKS_PER_NOTE = 2` in
`search.mjs`) keeps any single document from filling the context window
above 2 chunks — ported preventively from the source project's own
retrieval-mismatch bug (asking "why does this wiki use two-stage search?"
once surfaced a *reranking* note ahead of the wiki's own two-stage design,
because the two concepts are genuinely, confusably similar).

## Two real bugs, found live by actually running the eval suite

The corpus was deliberately written with a case designed to reproduce that
same failure mode: the SOX 404 walkthrough's "Phase 1"/"Phase 2" structure
is semantically close to the sampling methodology's "Stage 1"/"Stage 2"
structure — different concepts, similar shape. Running `npm run eval`
against the real embeddings surfaced two things worth writing down exactly
because neither is the bug I went looking for.

**Bug 1 — boilerplate "Related" sections were winning on title overlap.**
Every corpus document ends with a `## Related` section — a plain bulleted
list of links to other documents. Because that section literally contains
other documents' exact titles as anchor text, it embeds suspiciously close
to *any* query that mentions those titles — closer than the actual prose
discussing the concept, which uses natural sentences instead of exact
title strings. For "why does the audit sampling methodology use a
two-stage approach?", a `## Related` chunk from an unrelated document
outscored the sampling document's own content (0.617 vs. 0.597). For the
SOX Phase 2 question, two different documents' `## Related` sections took
the top two ranks entirely, and the SOX document's own actually-relevant
section didn't make the top 8 at all. **Fix**: `chunk.mjs` now skips any
H2 section titled "Related" — it's pure navigation, never answerable
content, so it has no business being retrievable in the first place. Not
present in Seth_Wiki's `chunk.mjs`; worth backporting there too.

**Bug 2 — a section that opens by referencing its sibling section dilutes
its own embedding.** After fixing bug 1, the SOX Phase 2 question still
failed: "Phase 2: Operating Effectiveness" wasn't retrieved at all, even
though it exists and even though "Phase 1" (from the same document) was.
The Phase 2 section's first sentence opened with *"Only after Phase 1
confirms..."* — leading with a forward-reference to its sibling section
instead of its own topic, which measurably diluted the chunk's own
semantic signal for a query specifically about Phase 2. **Fix**: rewrote
the section to lead with what it's actually about, moving the sequencing
note later in the paragraph — the same "each chunk should be a
self-contained unit" principle Seth_Wiki's own chunking contract already
states, just not something I'd seen violated visibly enough to notice
before running this eval for real.

Both fixes are in this repo's history. `npm run eval` is 17/17 as of this
writing (9 original cases plus 8 added when the corpus was expanded to
cover governance topics) — check it yourself rather than trusting this
paragraph, since
"don't trust the paragraph, run the eval" is the actual lesson both bugs
taught.

## Guardrails and observability (this project's own Phase 5)

- **Guardrail**: `search.mjs` exports `MIN_RETRIEVAL_SCORE`; if the top
  retrieved chunk's cosine similarity falls below it, `answer.mjs` returns
  a decline message *without calling the generation API* — a real gate on
  top of (not instead of) the system prompt's own "say so if you don't
  know" instruction.
- **Observability**: every query — question, retrieved chunks and scores,
  whether the guardrail fired, the answer, token usage — is appended to
  `logs/queries.jsonl` (gitignored) so behavior is debuggable after the
  fact.
- **Session cap**: the Streamlit app caps questions per browser session
  (5, `app/app.py`). This is a cost deterrent for a public demo, not real
  rate-limiting — flagged here so it doesn't read as more robust than it
  is.
- **Cost accounting**: every call is priced against real rates
  (`scripts/cost.mjs`) — Voyage `voyage-3-lite` embeddings at $0.02/MTok,
  Anthropic `claude-haiku-4-5` at $1 in / $5 out per MTok — and shown live
  in the Streamlit sidebar as a running session total, not estimated after
  the fact.

## Running locally

Requires Node 18+, Python 3.10+, and `anthropic.api_key` /
`voyage.api_key` in `~/.claude/secrets.yaml` (or `ANTHROPIC_API_KEY` /
`VOYAGE_API_KEY` env vars).

```bash
npm install
npm run ingest          # embeds the corpus into index/store.json
npm run ask -- "what's tested in Phase 2 of the SOX 404 walkthrough?"
npm run eval             # golden-question suite, incl. the guardrail + diversity cases

python -m venv app/.venv
app/.venv/Scripts/pip install -r app/requirements.txt   # Windows; app/.venv/bin/pip on macOS/Linux
app/.venv/Scripts/streamlit run app/app.py
```

CI (badge above) runs two checks: a free syntax check on every push and PR
(no API keys needed), and the real `npm run eval` suite on every push to
`main` — genuine Anthropic/Voyage calls against the committed
`index/store.json`, gated on `ANTHROPIC_API_KEY`/`VOYAGE_API_KEY` repo
secrets and restricted to `push` (not `pull_request`) so those secrets
never reach a fork-opened PR. `npm run ingest` itself still isn't run in
CI — `index/store.json` only needs regenerating locally when `corpus/`
changes, then re-committing.

## Live demo

**[84abkcnqvptyedbbssztx8.streamlit.app](https://84abkcnqvptyedbbssztx8.streamlit.app/)**
— deployed on [Streamlit Community Cloud](https://streamlit.io/cloud)
(free tier), verified working 2026-08-04 with a real cited, grounded
answer (not just a smoke test): "what's tested in Phase 2 of the SOX 404
walkthrough?" returned a correctly-sourced answer citing the SOX 404
walkthrough document, confirming both the Voyage embedding call and the
Anthropic generation call work end-to-end in the deployed environment,
not just locally.

Deployed by pointing Streamlit Cloud at this repo,
`audit-rag-assistant/app/app.py` as the entry point,
`audit-rag-assistant/app/requirements.txt` for Python dependencies, and
adding `anthropic_api_key` / `voyage_api_key` in that app's Secrets
manager — `app.py` forwards them into the Node subprocess's environment
as `ANTHROPIC_API_KEY`/`VOYAGE_API_KEY`.

Three things make the deployed environment work without running the full
local setup:

- `index/store.json` (the built embeddings) is **committed**, not
  gitignored, here — unlike Seth_Wiki, where it's a regenerable cache for
  a constantly-changing wiki. Streamlit Cloud can't run `npm run ingest`
  itself, so the pre-built index has to already be in the repo. Re-run
  `npm run ingest` locally and commit the result whenever `corpus/`
  changes.
- Root-level `packages.txt` (`nodejs`, `npm`) tells Streamlit Cloud's apt
  provisioning step to install Node, since `app.py` shells out to it.
- `secrets.mjs` only imports `js-yaml` (the one real npm dependency the
  query-time path could need) lazily, inside the local-file fallback
  branch — since Cloud always has the env vars set, that branch never
  runs there, so the deployed app needs no `npm install` step at all.

