import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import { OpenAIProvider } from "./openai";
import type { AIProvider } from "./types";
import type { ModelRoute } from "../routing";

/**
 * Resolves the provider for a route. Falls back to the mock provider when the vendor key is
 * missing or AI_FORCE_MOCK=true, so the whole app runs locally without keys.
 * Adding a vendor = one adapter file + one case here.
 */
export function resolveProvider(route: ModelRoute, mockOutput: () => unknown): { provider: AIProvider; model: string } {
  if (process.env.AI_FORCE_MOCK === "true") return { provider: new MockProvider(mockOutput), model: "mock" };
  switch (route.provider) {
    case "anthropic":
      if (process.env.ANTHROPIC_API_KEY) return { provider: new AnthropicProvider(process.env.ANTHROPIC_API_KEY), model: route.model };
      break;
    case "openai":
      if (process.env.OPENAI_API_KEY) return { provider: new OpenAIProvider(process.env.OPENAI_API_KEY), model: route.model };
      break;
  }
  return { provider: new MockProvider(mockOutput), model: "mock" };
}
