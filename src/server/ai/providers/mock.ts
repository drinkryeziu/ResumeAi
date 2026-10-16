import type { AIProvider, StructuredRequest, StructuredResponse } from "./types";

/**
 * Deterministic provider for local development and tests. It does not call a model:
 * the runner hands it the workflow's own `mock()` output, so every screen works without API keys.
 */
export class MockProvider implements AIProvider {
  readonly name = "mock" as const;

  constructor(private readonly produce: () => unknown) {}

  async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResponse> {
    const raw = this.produce();
    const approxTokens = Math.ceil((req.system.length + req.user.length) / 4);
    return { raw, usage: { inputTokens: approxTokens, outputTokens: Math.ceil(JSON.stringify(raw).length / 4) } };
  }
}
