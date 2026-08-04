// Ported as-is from Seth_Wiki's cost.mjs. Rates as of 2026-08-03.
export const PRICING = {
  voyage3lite: { perMillionTokens: 0.02 },
  claudeHaiku45: { inputPerMillionTokens: 1.0, outputPerMillionTokens: 5.0 },
};

export function estimateCostUsd({ embeddingTokens = 0, inputTokens = 0, outputTokens = 0 }) {
  const embedCost = (embeddingTokens / 1_000_000) * PRICING.voyage3lite.perMillionTokens;
  const inputCost = (inputTokens / 1_000_000) * PRICING.claudeHaiku45.inputPerMillionTokens;
  const outputCost = (outputTokens / 1_000_000) * PRICING.claudeHaiku45.outputPerMillionTokens;
  return embedCost + inputCost + outputCost;
}

export function formatUsageLine({ embeddingTokens = 0, inputTokens = 0, outputTokens = 0 }) {
  const cost = estimateCostUsd({ embeddingTokens, inputTokens, outputTokens });
  return `tokens: ${embeddingTokens} embed + ${inputTokens} in + ${outputTokens} out  (~$${cost.toFixed(5)})`;
}
