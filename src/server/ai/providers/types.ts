import type { z } from "zod/v4";

/**
 * The only contract workflows know about. Vendor SDKs live behind it, so adding or swapping
 * a provider never touches business logic.
 */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredRequest<T> {
  model: string;
  system: string;
  user: string;
  /** Zod schema the output must satisfy; converted to JSON Schema for the vendor. */
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens: number;
  temperature?: number;
}

export interface StructuredResponse {
  /** Unvalidated JSON from the model — the runner validates it with the schema. */
  raw: unknown;
  usage: Usage;
}

export interface AIProvider {
  readonly name: ProviderName;
  generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResponse>;
}

export type ProviderName = "anthropic" | "openai" | "mock";

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderName,
    readonly retryable: boolean,
    /** The vendor's HTTP status, when there was one (401 = key rejected, 429 = rate limit, 5xx = their outage). */
    readonly status?: number,
    /** A cause we can name for the site owner. Anthropic reports "out of credit" as a plain 400. */
    readonly reason?: "no_credit",
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

/** The AI key is missing on a production site. Never retry; say so plainly instead of serving sample text as if it were real. */
export class AINotConfiguredError extends AIProviderError {
  constructor() {
    super("AI writing is not set up on this site.", "anthropic", false);
    this.name = "AINotConfiguredError";
  }
}
