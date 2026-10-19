import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { AIProviderError, type AIProvider, type StructuredRequest, type StructuredResponse } from "./types";

/** Models that told us they don't accept a temperature setting. Learned on the first refusal and remembered while the server instance lives. */
const rejectsTemperature = new Set<string>();

/** Models that told us they won't take a forced tool call (tool_choice "tool"). For them the tool is offered and the prompt says to use it. */
const rejectsForcedTool = new Set<string>();

/** The vendor's sentence about what was wrong ("credit balance is too low", "temperature is deprecated for this model"), with anything key-shaped masked. */
export function vendorMessage(e: unknown): string {
  const nested = (e as { error?: { error?: { message?: string } } })?.error?.error?.message;
  return String(nested ?? (e as Error)?.message ?? "")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[hidden]")
    .slice(0, 240);
}

/**
 * Structured output via a single tool call: the tool's input_schema is the workflow's JSON Schema, so the model
 * answers in that shape. Where the model allows it the call is forced; some newer models refuse a forced tool call,
 * and for those the tool is offered with "auto" and the prompt tells the model to call it. The runner still validates with Zod.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  /**
   * `workspaceId` is for API keys that are not tied to one workspace: Anthropic then asks for the anthropic-workspace-id
   * header (ANTHROPIC_WORKSPACE_ID). Not needed for a key created inside a workspace.
   */
  constructor(apiKey: string, workspaceId?: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, ...(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}) });
  }

  async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResponse> {
    const jsonSchema = z.toJSONSchema(req.schema) as Record<string, unknown>;
    delete jsonSchema.$schema;
    let missingToolCalls = 0;
    for (;;) {
      const withTemperature = !rejectsTemperature.has(req.model);
      const forced = !rejectsForcedTool.has(req.model);
      try {
        const res = await this.client.messages.create({
          model: req.model,
          max_tokens: req.maxTokens,
          ...(withTemperature ? { temperature: req.temperature ?? 0.2 } : {}),
          system: forced ? req.system : `${req.system}\n\nAnswer by calling the tool "${req.schemaName}" exactly once with the complete result. Do not write any other text.`,
          tools: [
            {
              name: req.schemaName,
              description: "Return the result in exactly this structure.",
              input_schema: jsonSchema as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: forced ? { type: "tool", name: req.schemaName } : { type: "auto" },
          messages: [{ role: "user", content: req.user }],
        });
        const block = res.content.find((b) => b.type === "tool_use");
        if (!block || block.type !== "tool_use") {
          // Without a forced call the model can occasionally answer in prose: ask once more before giving up.
          if (!forced && missingToolCalls++ < 1) continue;
          throw new AIProviderError("Model returned no structured result", "anthropic", true);
        }
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
        if (forced && status === 400 && /tool_choice/i.test(detail)) {
          rejectsForcedTool.add(req.model);
          console.warn(`[ai] ${req.model} does not accept a forced tool call; using automatic tool choice. (${detail})`);
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
