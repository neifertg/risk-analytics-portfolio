import { loadSecret } from "./secrets.mjs";

// Ported as-is from Seth_Wiki's embed.mjs.
const MODEL = "voyage-3-lite";
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";

const MIN_INTERVAL_MS = 21_000;
const MAX_RETRIES = 5;
// Voyage's no-card free tier is 3 requests/minute. MIN_INTERVAL_MS paces a
// healthy run just under that. A 429 means the current window is already
// full: retrying 21s later (the old behavior) lands inside the same window,
// and another request — including the retry — keeps the budget exhausted.
// CI on 2026-08-21 failed this way. Two pushes overlapped on the same key,
// and this client logged six 429s, 21s apart, then gave up
// ("exceeded max retries after repeated rate limiting") while the other
// run was still embedding. Wait out a full minute first, then back off,
// and honor a longer Retry-After when the server sends one.
const RATE_LIMIT_FLOOR_MS = 60_000;
const MAX_BACKOFF_MS = 180_000;
let lastCallAt = 0;

// Serializes every embedTexts() call process-wide. Found live via
// audit-engagement-co-pilot's Phase 4 multi-agent evals: two concurrent
// tool_use calls in the same turn (e.g. a sub-agent calling both
// search_audit_standards and ask_audit_assistant in parallel) could each
// read lastCallAt as "clear to send" before either updated it, racing past
// the throttle below and tripping Voyage's free-tier rate limit even
// though MIN_INTERVAL_MS was never actually violated from a single
// caller's perspective. This project's own ingest.mjs/search.mjs only ever
// called embedTexts() sequentially, so the race never surfaced until a
// second caller (a real multi-agent system) started firing concurrently.
let queue = Promise.resolve();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry-After is either delta-seconds or an HTTP-date. Anything else
// (missing, empty, non-numeric) means the server didn't give us a wait.
export function parseRetryAfterMs(header, now = Date.now()) {
  if (header == null) return null;
  const trimmed = String(header).trim();
  if (trimmed === "") return null;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - now);
  return null;
}

// attempt is 1-based: the first 429 waits one full minute, the next two
// minutes, then the cap. A Retry-After longer than that floor is respected
// up to MAX_BACKOFF_MS so a single header can't pin a CI job for hours.
export function rateLimitWaitMs(attempt, retryAfterHeader, now = Date.now()) {
  const exponential = Math.min(RATE_LIMIT_FLOOR_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
  const headerMs = parseRetryAfterMs(retryAfterHeader, now);
  const wait = headerMs == null ? exponential : Math.max(exponential, headerMs);
  return Math.min(wait, MAX_BACKOFF_MS);
}

async function callVoyage(texts) {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();

  const apiKey = await loadSecret("voyage.api_key");
  return fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: texts, model: MODEL }),
  });
}

// Returns { embeddings, usage } — usage.totalTokens from Voyage's response.
export function embedTexts(texts) {
  const run = queue.then(() => embedTextsExclusive(texts));
  queue = run.catch(() => {});
  return run;
}

async function embedTextsExclusive(texts) {
  if (texts.length === 0) return { embeddings: [], usage: { totalTokens: 0 } };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await callVoyage(texts);

    if (res.status === 429) {
      const body = await res.text();
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `embed.mjs: exceeded max retries after repeated rate limiting (${res.status}): ${body.slice(0, 300)}`
        );
      }
      const waitMs = rateLimitWaitMs(attempt, res.headers.get("retry-after"));
      console.log(
        `embed: rate limited, waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${MAX_RETRIES})`
      );
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`embed.mjs: Voyage API request failed (${res.status}): ${body}`);
    }

    const json = await res.json();
    return { embeddings: json.data.map((d) => d.embedding), usage: { totalTokens: json.usage?.total_tokens ?? 0 } };
  }

  throw new Error("embed.mjs: exceeded max retries after repeated rate limiting");
}
