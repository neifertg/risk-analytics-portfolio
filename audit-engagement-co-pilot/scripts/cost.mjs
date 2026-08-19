// Pricing for the two models this project calls directly (Haiku sub-agents,
// Sonnet supervisor). Sub-agent RAG-tool costs (Haiku + Voyage) are already
// computed by audit-rag-assistant's own cost.mjs and come back embedded in
// ask_audit_assistant's tool_result -- this file only prices the tool-use
// loop calls made in this project (agent-loop.mjs). Rates as of 2026-08-19.
export const PRICING = {
  claudeHaiku45: { inputPerMillionTokens: 1.0, outputPerMillionTokens: 5.0 },
  claudeSonnet5: { inputPerMillionTokens: 3.0, outputPerMillionTokens: 15.0 },
};

export function estimateCostUsd(model, { inputTokens = 0, outputTokens = 0 }) {
  const rates = model === "claude-sonnet-5" ? PRICING.claudeSonnet5 : PRICING.claudeHaiku45;
  return (inputTokens / 1_000_000) * rates.inputPerMillionTokens + (outputTokens / 1_000_000) * rates.outputPerMillionTokens;
}
