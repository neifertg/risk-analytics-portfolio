# First Dockerfile in this portfolio. Must be built with the *portfolio
# root* (risk-analytics-portfolio/) as the build context, not this folder --
# audit-engagement-co-pilot imports audit-rag-assistant's scripts in-process
# and reads static output/*.json from three sibling projects, so the image
# needs all of them in the build context. From risk-analytics-portfolio/:
#
#   docker build -f audit-engagement-co-pilot/Dockerfile -t audit-engagement-co-pilot .
#   docker run -p 8080:8080 -e ANTHROPIC_API_KEY=... -e VOYAGE_API_KEY=... audit-engagement-co-pilot
#
# On Render: set "Root Directory" to the repo root and "Dockerfile Path" to
# audit-engagement-co-pilot/Dockerfile -- same split, just via the dashboard
# instead of -f. See README.md for the real env vars needed at runtime.
FROM node:22-slim

# Python + venv for sampling-calculator's sampling_cli.py shim. Only scipy
# is installed (not requirements.txt's pandas/matplotlib) -- those are for
# check.py/generate_populations.py, never invoked at runtime by the MCP
# tools this server exposes. See Seth_Wiki/projects/audit-engagement-co-pilot.md
# for why check.py's own live rerun was dropped in favor of a static read.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Two npm ci calls, per the plan's documented cross-folder coupling:
# audit-rag-assistant is imported in-process by tools.mjs for
# retrieve()/answerQuestion(), so its own node_modules (notably
# @lancedb/lancedb, a native addon) has to exist too. Copy each
# package*.json first so this layer only rebuilds when dependencies
# actually change, not on every source edit.
COPY audit-rag-assistant/package.json audit-rag-assistant/package-lock.json ./audit-rag-assistant/
RUN cd audit-rag-assistant && npm ci --omit=dev

COPY audit-engagement-co-pilot/package.json audit-engagement-co-pilot/package-lock.json ./audit-engagement-co-pilot/
RUN cd audit-engagement-co-pilot && npm ci --omit=dev

RUN python3 -m venv sampling-calculator/.venv \
    && sampling-calculator/.venv/bin/pip install --no-cache-dir scipy

# Now the actual source. audit-rag-assistant/index/lancedb/ is committed
# (see that project's .gitignore comment) so retrieval works without a
# separate ingest step in the container.
COPY audit-rag-assistant/ ./audit-rag-assistant/
COPY audit-engagement-co-pilot/ ./audit-engagement-co-pilot/
COPY sampling-calculator/sampling.py sampling-calculator/sampling_cli.py ./sampling-calculator/
COPY benfords-law-analyzer/output ./benfords-law-analyzer/output
COPY duplicate-vendor-payment-checker/output ./duplicate-vendor-payment-checker/output
COPY duplicate-payment-anomaly-detection/output ./duplicate-payment-anomaly-detection/output

WORKDIR /app/audit-engagement-co-pilot
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "scripts/server.mjs"]
