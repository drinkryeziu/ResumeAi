import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

const create = vi.hoisted(() => vi.fn());
const clientOptions = vi.hoisted(() => ({ last: undefined as unknown }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
    constructor(opts: unknown) {
      clientOptions.last = opts;
    }
  },
}));

const { AnthropicProvider } = await import("@/server/ai/providers/anthropic");
const { AIProviderError } = await import("@/server/ai/providers/types");

const ok = { content: [{ type: "tool_use", input: { answer: "hi" } }], usage: { input_tokens: 10, output_tokens: 5 } };
const refusal = (status: number, message: string) =>
  Object.assign(new Error(`${status} ${message}`), { status, error: { type: "error", error: { type: "invalid_request_error", message } } });
const request = (model: string) => ({ model, system: "s", user: "u", schema: z.object({ answer: z.string() }), schemaName: "test_tool", maxTokens: 100, temperature: 0.3 });

describe("Anthropic provider", () => {
  it("sends the workspace id header only when one is configured", () => {
    new AnthropicProvider("sk-test", "wrkspc_123");
    expect(clientOptions.last).toMatchObject({ defaultHeaders: { "anthropic-workspace-id": "wrkspc_123" } });
    new AnthropicProvider("sk-test");
    expect(clientOptions.last).not.toHaveProperty("defaultHeaders");
  });

  it("sends temperature, and on a model that refuses it retries without it and remembers", async () => {
    create.mockReset();
    create.mockRejectedValueOnce(refusal(400, "`temperature` is deprecated for this model.")).mockResolvedValueOnce(ok);
    const provider = new AnthropicProvider("sk-test");
    const res = await provider.generateStructured(request("model-that-refuses-temperature"));
    expect(res.raw).toEqual({ answer: "hi" });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]![0]).toHaveProperty("temperature", 0.3);
    expect(create.mock.calls[1]![0]).not.toHaveProperty("temperature");

    create.mockReset();
    create.mockResolvedValueOnce(ok);
    await new AnthropicProvider("sk-test").generateStructured(request("model-that-refuses-temperature"));
    expect(create.mock.calls[0]![0]).not.toHaveProperty("temperature"); // learned: not sent the next time
  });

  it("still sends temperature to models that accept it", async () => {
    create.mockReset();
    create.mockResolvedValueOnce(ok);
    await new AnthropicProvider("sk-test").generateStructured(request("model-that-accepts-temperature"));
    expect(create.mock.calls[0]![0]).toHaveProperty("temperature", 0.3);
  });

  it("carries the vendor's reason on a refusal, with anything key-shaped masked", async () => {
    create.mockReset();
    create.mockRejectedValueOnce(refusal(400, "messages.0.content: something is wrong with sk-ant-api03-ABCDEFGH12345678"));
    const err = await new AnthropicProvider("sk-test").generateStructured(request("another-model")).catch((e) => e);
    expect(err).toBeInstanceOf(AIProviderError);
    expect(err.status).toBe(400);
    expect(err.detail).toContain("something is wrong");
    expect(err.detail).not.toContain("sk-ant");
    expect(err.retryable).toBe(false);
  });

  it("recognizes an empty balance", async () => {
    create.mockReset();
    create.mockRejectedValueOnce(refusal(400, "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing."));
    const err = await new AnthropicProvider("sk-test").generateStructured(request("a-third-model")).catch((e) => e);
    expect(err.reason).toBe("no_credit");
  });
});
