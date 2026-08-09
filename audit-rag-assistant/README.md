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
this port didn't need to spend to make the point. The 28 procedure
documents in `corpus/` are self-written, covering a real internal-audit
curriculum: fieldwork-level testing (SOX 404 testing, sampling
methodology, vendor/expense/access controls, revenue recognition,
segregation of duties, journal entry testing, inventory observation,
contract compliance, procurement/PO matching, treasury/cash management,
payroll/HR controls, fixed assets/CapEx), department-level governance
(risk assessment, enterprise risk management/risk appetite, whistleblower
hotline handling, third-party vendor risk, business continuity/disaster
recovery, audit committee reporting), and a dedicated IT-audit cluster
(IT change management, IT user access review, IT general controls
overview, cybersecurity controls, cloud computing controls, data
governance, data privacy, IT risk assessment/audit universe) — plausible,
not authoritative. Don't cite this corpus as real audit guidance.

The IT-audit cluster in particular is informed by (never copied from) real
IIA/ISACA/COSO/NIST/Big-4 standards research done separately, in a private
repo, with disclosed-provenance citations — that real-standards material
stays out of this public repo by design. What's here is this repo's own
self-written synthetic corpus, just now covering the same topic areas.

One deliberate exception to "synthetic only": `corpus-tailored/` holds a
second, small corpus of **real, already-publicly-published** documents
from one real organization (University of California/UCLA) — publicly
posted government/public-institution material, summarized with source
links rather than reproduced, not the same copyright situation as a
paywalled IIA/COSO standard. See "Tailoring" below.

## Architecture

```
corpus/*.md  →  chunk.mjs  →  embed.mjs (Voyage voyage-3-lite)  →  index/lancedb/ (LanceDB)
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

`index/lancedb/` is a real embedded vector index
([LanceDB](https://lancedb.com), `@lancedb/lancedb`) — local files, no
server process — replacing an earlier flat-JSON/brute-force-cosine store.
Chroma was the original plan, but its Node client turned out to talk to a
separate running Chroma server rather than embedding in-process like its
Python client does; LanceDB is the one that's actually embedded on Node.
`search.mjs`'s two queries (`.search(vector).distanceType("cosine")`,
filtered by `kind`/`noteId`) replace the old in-memory cosine loop;
`capPerNote`'s per-document diversity cap stays application-side, since
LanceDB has no "max N per group" primitive. `index/store.json` still
exists, but only as `ingest.mjs`'s local, gitignored cache for skipping
re-embedding unchanged chunks — it's no longer what gets queried or
committed. `package.json`'s `overrides` pins `sharp` to a patched version:
`@lancedb/lancedb` optionally depends on `@huggingface/transformers` (its
built-in embedding-function convenience API, unused here since this
project brings its own Voyage embeddings) which pulled in a `sharp`
version with known libvips CVEs — `npm audit` was 0 vulnerabilities before
committing this.

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

Both fixes are in this repo's history. `npm run eval` is 28/28 as of this
writing (9 original cases, 8 added when the corpus was expanded to cover
governance topics, 8 more added with the treasury/payroll/fixed-assets and
IT-audit-cluster expansion, and 3 generic-vs-tailored comparison cases —
see "Tailoring" below) — check it yourself rather than trusting this
paragraph, since
"don't trust the paragraph, run the eval" is the actual lesson both bugs
taught.

## Tailoring: generic methodology vs. a real organization's own documents

Everything above is this repo's own self-written synthetic corpus — good
for general audit-methodology questions, but it can't know anything
specific to a real organization, because no real organization's documents
are in it. `corpus-tailored/uc-ucla/` adds a second, small corpus of
**real, publicly published University of California documents** — not
synthetic, not paraphrased from a secondary source, but the university's
own actual charter, audit plan, a real campus procedure, and real
completed audit reports:

- [Internal Audit Charter](https://www.ucop.edu/ethics-compliance-audit-services/audit/internal-audit-charter.html) —
  UC's real systemwide governing charter.
- [Internal Audit Plan for 2022-23](https://regents.universityofcalifornia.edu/regmeet/july22/c1attach2.pdf) —
  UC's real annual risk-based audit plan, with named systemwide audit
  projects and a real cybersecurity-audit priority list.
- [UCLA Procedure 825.1](https://www.adminpolicies.ucla.edu/pdf/825-1.pdf) —
  UCLA's real, currently-effective (April 2025) building-access procedure.
- Four real completed audit reports pulled from
  [UC's public audit-report archive](https://auditreports.ucop.edu)
  (2,600+ real reports, searchable by campus/year): a systemwide foreign-
  influence audit, UCLA's post-"Varsity Blues" undergraduate admissions
  audit, UC San Diego's Supercomputer Center IT-security audit, and UC
  Santa Barbara's third-party IT services audit.

UC/UCLA was picked after actually checking (not assuming) which
candidate universities publish enough real material to be worth
grounding on — most schools publish a charter and nothing else; UC's own
public archive of thousands of real, unredacted completed audit reports
was the deciding factor. Every one of the reports above was individually
opened and read before inclusion — two candidates ("no significant
observations noted" reports) were found and deliberately rejected as too
thin to be worth citing.

**Why this matters, concretely**: ask the deployed app "how should
building or system access be removed when someone leaves or transfers?"
with the corpus scope set to **Both**, and the answer doesn't just recite
one generic procedure — it explicitly contrasts the generic corpus's
24–48-hour deprovisioning rule against UCLA's actual named escalation
path (notify UCPD if a badge or key isn't returned), then cites a real UC
San Diego audit finding where a data center's access credentials were
"configured to never expire" as a live illustration of the exact risk the
generic procedure warns about. That three-way contrast — generic
guidance, one real organization's own procedure, and a real finding from
that organization's own audit history — is the actual value proposition
of tailoring a RAG assistant to a specific company, made concrete instead
of asserted.

### How the scope toggle works

A **Corpus scope** selector (Generic Methodology / the tailored org's
name / Both) appears in the app automatically once `corpus-tailored/`
has real content indexed — it stays hidden otherwise, rather than
offering a choice with nothing behind one of the options. Under the hood:
every chunk carries a `corpus` (`"generic"`/`"tailored"`) and
`corpusSource` field (`scripts/lib.mjs`, `scripts/chunk.mjs`), populated
by folder convention so none of the 28 generic docs needed any edit;
`scripts/search.mjs`'s `retrieve(query, { corpus })` filters both
retrieval stages by scope, applied *before* the existing
`MAX_CHUNKS_PER_NOTE` diversity cap so that cap needed zero code changes
to keep working correctly in every scope. Try it yourself:

```bash
npm run ask -- "what does UCLA's own access procedure require?" --corpus tailored
npm run search -- "cybersecurity" --corpus generic
npm run eval    # includes 3 generic-vs-tailored comparison cases
```

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
npm run ingest          # embeds the corpus into index/lancedb/
npm run ask -- "what's tested in Phase 2 of the SOX 404 walkthrough?"
npm run eval             # golden-question suite, incl. the guardrail + diversity cases

python -m venv app/.venv
app/.venv/Scripts/pip install -r app/requirements.txt   # Windows; app/.venv/bin/pip on macOS/Linux
app/.venv/Scripts/streamlit run app/app.py
```

CI (badge above) runs two checks: a free syntax check on every push and PR
(no API keys needed), and the real `npm run eval` suite on every push to
`main` — genuine Anthropic/Voyage calls against the committed
`index/lancedb/`, gated on `ANTHROPIC_API_KEY`/`VOYAGE_API_KEY` repo
secrets and restricted to `push` (not `pull_request`) so those secrets
never reach a fork-opened PR. `npm run ingest` itself still isn't run in
CI — `index/lancedb/` only needs regenerating locally when `corpus/`
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

- `index/lancedb/` (the built vector index) is **committed**, not
  gitignored, here — unlike Seth_Wiki, where its equivalent cache is
  regenerable for a constantly-changing wiki. Streamlit Cloud can't run
  `npm run ingest` itself, so the pre-built index has to already be in the
  repo. Re-run `npm run ingest` locally and commit the result whenever
  `corpus/` changes.
- Root-level `packages.txt` (`nodejs`, `npm`) tells Streamlit Cloud's apt
  provisioning step to install Node, since `app.py` shells out to it.
- **A real bug, found and fixed this session, not hypothetical**: nothing
  in the deploy path ever ran `npm install`/`npm ci`, and `node_modules/`
  isn't committed — Streamlit Community Cloud doesn't auto-install npm
  dependencies from `package.json` at all. `stats.mjs` imports
  `gray-matter` directly, so the sidebar's "Indexed: N documents" line was
  almost certainly silently broken on the live deployment: `app.py`'s
  `get_stats()` swallows a non-zero exit and just renders nothing, no
  visible error. Adding `@lancedb/lancedb` (a native package, unlike the
  pure-JS `gray-matter`/`js-yaml`) would have broken the real Q&A path the
  same way, not just a decorative stat. Fixed by having `app.py` run
  `npm ci` once at startup (`st.cache_resource`-guarded, only if
  `node_modules/` doesn't already exist) before any subprocess call that
  needs it.

