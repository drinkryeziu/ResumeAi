import { AINotConfiguredError, AIProviderError } from "./providers/types";

/**
 * What to tell the person when the AI service itself failed. Temporary trouble (busy, rate limit, their outage) says "try again";
 * a refusal that retrying can't fix (key rejected, no credit, unknown model) says so, so the site owner knows where to look.
 * Never includes the vendor's raw message.
 */
export function describeAIError(e: AIProviderError, action = "do this"): string {
  if (e instanceof AINotConfiguredError) return `AI writing isn't switched on for this site yet, so we can't ${action}. The site owner needs to add the AI key.`;
  const s = e.status;
  if (s !== undefined && s >= 400 && s < 500 && s !== 429 && s !== 408) {
    return `The AI service refused the request (error ${s}), so we couldn't ${action}. If this keeps happening, the site owner should check the AI key, its billing and the model name.`;
  }
  return `The AI service is busy right now, so we couldn't ${action}. Please try again in a minute.`;
}
