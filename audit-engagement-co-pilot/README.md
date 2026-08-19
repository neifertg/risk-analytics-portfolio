# Audit Engagement Co-Pilot

A hierarchical multi-agent audit assistant: a supervisor decomposes a
plain-language audit question and dispatches it to specialist sub-agents,
each wrapping a tool that already existed and already worked elsewhere in
this portfolio — a RAG assistant, a Benford's Law analyzer, two
duplicate-payment detectors, a statistical sampling calculator — behind a
real MCP server. The point isn't any one tool; it's that this is the first
project in this portfolio where the tools talk to each other, and where a
supervisor has to reconcile two specialists that don't fully agree.

[Live demo](https://audit-engagement-co-pilot.onrender.com)

```
curl https://audit-engagement-co-pilot.onrender.com/ask -X POST \
  -H "Content-Type: application/json" \
  -d '{"question": "Are there any duplicate payment flags in the AP ledger?"}'
```

The free-tier host sleeps after 15 minutes idle — the first request after a
gap takes 30-60s to wake up.

## Architecture

```
Question
   │
   ▼
Supervisor (Sonnet)  ──dispatch_sampling──▶  Sampling sub-agent (Haiku)
   │                  ──dispatch_fraud_risk──▶  Fraud-risk sub-agent (Haiku)
   │                  ──dispatch_standards──▶  Standards sub-agent (Haiku)
   ▼                                              │
Synthesized, cited answer  ◀──────────────────────┘
                                                   │
                                          MCP Server (7 tools)
                                     wrapping 5 already-shipped
                                       projects in this portfolio
```

The supervisor never calls the raw MCP tools directly — its only tools are
one `dispatch_*` per sub-agent. A `dispatch_*` call runs a full nested
Haiku tool-use loop; the sub-agent's final answer becomes the `tool_result`
the supervisor sees. Each sub-agent is scoped to only its own MCP
tools — the sampling sub-agent literally cannot call `check_duplicate_payments`,
because it's never told the tool exists.

**Real fan-out + reconciliation, not staged.** A question that touches both
fraud risk and standards dispatches to both sub-agents in the same turn and
gets synthesized, with disagreement stated explicitly rather than papered
over. From a real run (`logs/queries.jsonl`, not fabricated for this
README):

> **Q:** *"Our duplicate-payment checker flagged several payments in the AP
> ledger. Given that finding, what does COSO/IIA say we should do about a
> control deficiency like this, and does the fraud-risk data actually show
> a real problem?"*
>
> Dispatched to: `fraud-risk`, `standards` (2 supervisor turns, $0.092 total)
>
> **Fraud-risk specialist:** "Yes, credibly so... 52 of 919 payments
> (~5.7%)... 98.1% recall, 100% precision against the seeded ground
> truth... this is a seeded synthetic dataset used for demonstration
> purposes, not your live production ledger."
>
> **Standards specialist:** "The corpus does **not** contain the actual
> COSO Internal Control framework component/principle language or IIA IPPF
> standard citations you asked for" — flagged the gap explicitly instead of
> inventing a citation, then answered from what the corpus *did* contain
> (SOX 404-oriented deficiency-classification guidance).
>
> **Supervisor's synthesis** stated both: a credible, well-corroborated
> fraud-risk finding *and* a real limitation in what the standards corpus
> could confirm — not blended into one confident-sounding answer.

## Static vs. dynamic tools — drawn honestly, not assumed

Of the 7 MCP tools, four are genuinely dynamic (`search_audit_standards`,
`ask_audit_assistant` import `retrieve()`/`answerQuestion()` directly from
the RAG assistant; `plan_audit_sample`/`evaluate_audit_sample` call a new
`sampling_cli.py` shim over the sampling calculator's existing pure
functions). Three are static reads of already-committed `output/*.json`:
`check_duplicate_payments`, `get_benfords_analysis`,
`get_fraud_ml_comparison`. That last one was originally scoped to re-run
its underlying script live — design review found the script has no
per-query input variation (always reads the same hardcoded ledger) and
unconditionally overwrites its own output on every call, so "live"
execution would produce identical output to the committed file, at the
cost of a write-race under concurrent requests. Every static tool's
description says so in words the model surfaces, and it does — see the
fraud-risk specialist's answer above, which says "seeded synthetic
dataset" unprompted, not because the question asked for that caveat.

## What a framework would give me for free

No LangGraph, no CrewAI — the tool-use loop (`agent-loop.mjs`) is hand-rolled,
matching this portfolio's RAG assistant's own no-framework RAG pipeline.
What that costs, stated plainly rather than left undocumented: no automatic
retry/backoff on a transport error, a fixed max-turn cap (6) rather than
adaptive budgeting, and no built-in context compaction for a very long
multi-turn trace. For a project this size the tradeoff is worth it —
building the loop by hand is the actual point, not a framework dependency
padding a skills list.

## Two real bugs, found live by genuine concurrent load

Building the multi-agent eval suite (Phase 4) was the first time this
project's own tool calls ran genuinely in parallel — no earlier phase's
tests exercised it, and it surfaced two real problems in one afternoon,
neither staged:

1. **A race condition** in the RAG assistant's Voyage embedding rate-limit
   throttle — a module-level `lastCallAt` timestamp read-then-written
   non-atomically, so two concurrent embedding calls (e.g. a sub-agent's
   own parallel `search_audit_standards` + `ask_audit_assistant` tool_use)
   could both see "clear to send" before either updated it, racing past the
   throttle and tripping Voyage's rate limit. Fixed by serializing every
   embedding call through a promise-chain mutex.
2. That fix then exposed a **second, distinct bug**: the MCP SDK's default
   60-second per-call timeout became too short once a second concurrent
   tool call had to wait behind the first one's full
   throttle-plus-retry duration. Confirmed by direct trace inspection —
   the actual error was `MCP error -32001: Request timed out`, not the
   rate-limit error the first fix's mutex would suggest — before writing a
   fix for it. Fixed with a generous 5-minute client-side timeout, since
   it's an in-process call with no real network hop.

## Multi-agent evals

`npm run eval` — 6/6 passing, extending the RAG assistant's own
deterministic keyword-matching pattern (no LLM-judge). What's new here
isn't retrieval quality, it's the multi-step trace:

- Two single-specialist cases assert **exact** dispatch (no gratuitous
  fan-out when a question doesn't need it).
- Two cases assert the static-tool "pre-computed on a seeded synthetic
  dataset" framing actually surfaces in the final synthesized answer, not
  just in the tool's own description.
- One genuine fan-out + reconciliation case (the example above).
- One real induced failure — a `sampling.py` business-logic error
  (expected misstatement exceeding tolerable misstatement) — asserting the
  run degrades to a coherent explanation instead of crashing.

Every phase has its own real test suite: 7 MCP tools (`npm run test-tools`,
13/13, one induced failure per tool), the 3 sub-agents in isolation
(`npm run test-agents`, 13/13, real Anthropic API calls), the supervisor
(`npm run test-supervisor`, 8/8), and the eval suite above.

## Running locally

```
npm run ask-supervisor -- "your question"   # CLI
npm start                                    # node:http server on :8080
```

Needs `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` — env var or
`~/.claude/secrets.yaml`, same resolution as everywhere else in this
portfolio.

## Deployment

Docker + a minimal `node:http` server, no Express — a single `POST /ask`
plus a health check, with a per-IP cost cap (5 questions/hour) matching the
RAG assistant's Streamlit demo's per-session cap. Live on Render; see
`Dockerfile` for the build (portfolio-root context, since this project
imports the RAG assistant's scripts in-process and reads static output
from three sibling projects).
