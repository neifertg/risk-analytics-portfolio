import { loadSecret } from "./secrets.mjs";

// Ported as-is from Seth_Wiki's embed.mjs.
const MODEL = "voyage-3-lite";
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";

const MIN_INTERVAL_MS = 21_000;
const MAX_RETRIES = 5;
let lastCallAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
export async function embedTexts(texts) {
  if (texts.length === 0) return { embeddings: [], usage: { totalTokens: 0 } };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await callVoyage(texts);

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : MIN_INTERVAL_MS;
      console.log(`embed: rate limited, waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${MAX_RETRIES})`);
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
