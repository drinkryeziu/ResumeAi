import type { Usage } from "./providers/types";

/**
 * Vendor list prices in USD per million tokens, used to estimate cost per AI run.
 * Claude prices from https://platform.claude.com/docs/en/about-claude/pricing (checked 2026-10-16).
 * Add a row when you route a workflow to a new model; unknown models are recorded at $0 and logged.
 */
const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  // Haiku 5.5 is tiered: prompts over 100K tokens cost $0.50 / $2.50.
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  mock: { input: 0, output: 0 },
};

const HAIKU_LONG = { input: 0.5, output: 2.5 };

export function estimateCostUsd(model: string, usage: Usage): number {
  let price = PRICES_PER_MTOK[model];
  if (model === "claude-haiku-5-5" && usage.inputTokens > 100_000) price = HAIKU_LONG;
  if (!price) {
    console.warn(`[ai/pricing] No price for model "${model}"; recording $0. Add it to PRICES_PER_MTOK.`);
    return 0;
  }
  return Number(((usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000).toFixed(6));
}
