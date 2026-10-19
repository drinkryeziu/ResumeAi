import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import { OpenAIProvider } from "./openai";
import { AINotConfiguredError, type AIProvider } from "./types";
import type { ModelRoute } from "../routing";

/**
 * The built-in sample writer is for local development and tests. On a production site it is off, so real users are never
 * handed sample text as if the AI had written it; AI_ALLOW_MOCK=true turns it back on (for a preview).
 */
export const mockAllowed = () => process.env.NODE_ENV !== "production" || process.env.AI_ALLOW_MOCK === "true";

/** Whether the AI the routes use (Anthropic) has its key. */
export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

/** Can AI actions run at all here: with a key, or with the sample writer where that is allowed. */
export const aiAvailable = () => process.env.AI_FORCE_MOCK === "true" || aiConfigured() || mockAllowed();

/**
 * Resolves the provider for a route. Falls back to the mock provider when the vendor key is missing (development and tests)
 * or AI_FORCE_MOCK=true, so the whole app runs locally without keys. In production a missing key is an error instead.
 * Adding a vendor = one adapter file + one case here.
 */
export function resolveProvider(route: ModelRoute, mockOutput: () => unknown): { provider: AIProvider; model: string } {
  if (process.env.AI_FORCE_MOCK === "true") return { provider: new MockProvider(mockOutput), model: "mock" };
  switch (route.provider) {
    case "anthropic":
      if (process.env.ANTHROPIC_API_KEY)
        return { provider: new AnthropicProvider(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_WORKSPACE_ID?.trim() || undefined), model: route.model };
      break;
    case "openai":
      if (process.env.OPENAI_API_KEY) return { provider: new OpenAIProvider(process.env.OPENAI_API_KEY), model: route.model };
      break;
  }
  if (!mockAllowed()) throw new AINotConfiguredError();
  return { provider: new MockProvider(mockOutput), model: "mock" };
}
