import OpenAI from "openai";
import { z } from "zod/v4";
import { AIProviderError, type AIProvider, type StructuredRequest, type StructuredResponse } from "./types";

/** Structured output via response_format json_schema. */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, maxRetries: 2 });
  }

  async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResponse> {
    const jsonSchema = z.toJSONSchema(req.schema) as Record<string, unknown>;
    delete jsonSchema.$schema;
    try {
      const res = await this.client.chat.completions.create({
        model: req.model,
        max_completion_tokens: req.maxTokens,
        temperature: req.temperature ?? 0.2,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        response_format: { type: "json_schema", json_schema: { name: req.schemaName, schema: jsonSchema, strict: false } },
      });
      const text = res.choices[0]?.message?.content;
      if (!text) throw new AIProviderError("Model returned no content", "openai", true);
      return {
        raw: JSON.parse(text),
        usage: { inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: res.usage?.completion_tokens ?? 0 },
      };
    } catch (e) {
      if (e instanceof AIProviderError) throw e;
      if (e instanceof SyntaxError) throw new AIProviderError("Model returned invalid JSON", "openai", true);
      const status = (e as { status?: number }).status;
      throw new AIProviderError(`OpenAI request failed${status ? ` (${status})` : ""}`, "openai", status === 429 || (status ?? 500) >= 500);
    }
  }
}
