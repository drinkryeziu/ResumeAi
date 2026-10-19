import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { AIProviderError, type AIProvider, type StructuredRequest, type StructuredResponse } from "./types";

/** Models that told us they don't accept a temperature setting. Learned on the first refusal and remembered while the server instance lives. */
const rejectsTemperature = new Set<string>();

/** The vendor's sentence about what was wrong ("credit balance is too low", "temperature is deprecated for this model"), with anything key-shaped masked. */
export function vendorMessage(e: unknown): string {
  const nested = (e as { error?: { error?: { message?: string } } })?.error?.error?.message;
  return String(nested ?? (e as Error)?.message ?? "")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[hidden]")
    .slice(0, 240);
}

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
    for (;;) {
      const withTemperature = !rejectsTemperature.has(req.model);
      try {
        const res = await this.client.messages.create({
          model: req.model,
          max_tokens: req.maxTokens,
          ...(withTemperature ? { temperature: req.temperature ?? 0.2 } : {}),
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
        const detail = vendorMessage(e);
        if (withTemperature && status === 400 && /temperature/i.test(detail)) {
          // Newer models refuse a temperature setting. Don't send it to this model again; try this request once more without it.
          rejectsTemperature.add(req.model);
          console.warn(`[ai] ${req.model} does not accept temperature; retrying without it. (${detail})`);
          continue;
        }
        // The vendor's explanation goes to the server log and, for the site owner, onto the error message. It never contains the key.
        console.error(`[ai] Anthropic request failed: model=${req.model} status=${status ?? "none"} ${detail}`);
        const reason = /credit balance|billing/i.test(detail) ? ("no_credit" as const) : undefined;
        throw new AIProviderError(`Anthropic request failed${status ? ` (${status})` : ""}`, "anthropic", status === 429 || (status ?? 500) >= 500, status, reason, detail);
      }
    }
  }
}
