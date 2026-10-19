import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { AIProviderError, type AIProvider, type StructuredRequest, type StructuredResponse } from "./types";

/**
 * Structured output via a single forced tool call: the tool's input_schema is the workflow's
 * JSON Schema, so the model must answer in that shape. The runner still validates with Zod.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2 });
  }

  async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResponse> {
    const jsonSchema = z.toJSONSchema(req.schema) as Record<string, unknown>;
    delete jsonSchema.$schema;
    try {
      const res = await this.client.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        temperature: req.temperature ?? 0.2,
        system: req.system,
        tools: [
          {
            name: req.schemaName,
            description: "Return the result in exactly this structure.",
            input_schema: jsonSchema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: req.schemaName },
        messages: [{ role: "user", content: req.user }],
      });
      const block = res.content.find((b) => b.type === "tool_use");
      if (!block || block.type !== "tool_use") throw new AIProviderError("Model returned no structured result", "anthropic", true);
      return { raw: block.input, usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens } };
    } catch (e) {
      if (e instanceof AIProviderError) throw e;
      const status = (e as { status?: number }).status;
      // The vendor's own explanation ("credit balance is too low", "model not found"...) goes to the server log only; it never contains the key.
      console.error(`[ai] Anthropic request failed: model=${req.model} status=${status ?? "none"} ${(e as Error).message?.slice(0, 300)}`);
      throw new AIProviderError(`Anthropic request failed${status ? ` (${status})` : ""}`, "anthropic", status === 429 || (status ?? 500) >= 500, status);
    }
  }
}
