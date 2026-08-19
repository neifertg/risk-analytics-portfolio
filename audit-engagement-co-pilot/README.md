# Audit Engagement Co-Pilot

**Status: Phase 5 of 6 (Docker + deployment) — done. Not yet a full
project.** Full build story, architecture reasoning, and phase plan live in
this portfolio's parent wiki, not duplicated here — this README will be
replaced with the real project writeup in Phase 6 (portfolio placement).

## What's real right now

A working MCP server (`@modelcontextprotocol/sdk`) exposing 7 tools over
`InMemoryTransport.createLinkedPair()`, each wrapping an existing, already-
shipped tool elsewhere in this portfolio rather than reimplementing it:

- `search_audit_standards` / `ask_audit_assistant` — import `retrieve()` /
  `answerQuestion()` directly from `../audit-rag-assistant/scripts/`.
- `check_duplicate_payments`, `get_benfords_analysis`,
  `get_fraud_ml_comparison` — read already-committed `output/*.json` from
  `../duplicate-vendor-payment-checker/`, `../benfords-law-analyzer/`, and
  `../duplicate-payment-anomaly-detection/` respectively. Deliberately
  static, not live re-execution — see `scripts/tools.mjs`'s header comment
  for why.
- `plan_audit_sample` / `evaluate_audit_sample` — call a small new
  `sampling_cli.py` shim (in `../sampling-calculator/`) that wraps
  `sampling.py`'s existing pure functions over a stdin-JSON/stdout-JSON
  contract.

Run `npm run test-tools` to verify: connects a real `Client` to the real
`Server`, calls every tool with valid input, and induces one real failure
per tool (bad schema input, a real `sampling.py` business-logic error, a
missing file) to confirm each one resolves to a well-formed error rather
than crashing.

On top of the tools: a hand-rolled tool-use loop (`scripts/agent-loop.mjs`),
three Haiku sub-agents (`scripts/sub-agents.mjs`), and a Sonnet supervisor
(`scripts/supervisor.mjs`) that dispatches to them — never the raw MCP
tools directly — with full multi-agent trace logging. `npm run
test-agents` (13/13) and `npm run test-supervisor` (8/8) verify these
against the real Anthropic API. `npm run eval` (6/6) runs the multi-agent
eval suite: dispatch discipline, the static-tool "pre-computed on a seeded
synthetic dataset" framing surfacing into final answers, a genuine
fan-out + reconciliation case, and a real induced failure that degrades
gracefully instead of crashing.

## Running locally

```
npm run ask-supervisor -- "your question"   # CLI
npm start                                    # node:http server on :8080
```

`npm start` needs `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` in the
environment (or `~/.claude/secrets.yaml`, same resolution as everywhere
else in this portfolio — see `audit-rag-assistant/scripts/secrets.mjs`).
Once running:

```
curl http://localhost:8080/                                          # health check
curl http://localhost:8080/ask -X POST -H "Content-Type: application/json" \
  -d '{"question": "Are there any duplicate payment flags in the AP ledger?"}'
```

The server caps questions at 5 per IP per hour — a cheap deterrent for a
public demo's API spend, same ethos as the RAG assistant's Streamlit app
capping questions per browser session, not real abuse protection.

## Deployment (Docker + Render)

`Dockerfile` is new here and needs the **portfolio root**
(`risk-analytics-portfolio/`) as its build context, not this folder —
this project imports `audit-rag-assistant`'s scripts in-process and reads
static `output/*.json` from three sibling projects, so the image needs all
of them. From `risk-analytics-portfolio/`:

```
docker build -f audit-engagement-co-pilot/Dockerfile -t audit-engagement-co-pilot .
docker run -p 8080:8080 -e ANTHROPIC_API_KEY=... -e VOYAGE_API_KEY=... audit-engagement-co-pilot
```

On Render (a Web Service, Docker runtime): set **Root Directory** to the
repo root and **Dockerfile Path** to `audit-engagement-co-pilot/Dockerfile`
— same split as the local `-f` flag above, via the dashboard instead.
Health check path is `/`. Set `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` as
environment variables in the Render dashboard (never commit them). Render
sets `PORT` itself; `server.mjs` already reads it via `process.env.PORT`.

## Not built yet

Phase 6 (portfolio placement — this README's real writeup, an `index.md`
card in this portfolio, and the `ai-engineer-portfolio-signal.md` update)
— see the parent wiki's implementation plan for what's next.
