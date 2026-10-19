import { describe, expect, it } from "vitest";
import { describeAIError } from "@/server/ai/errors";
import { AINotConfiguredError, AIProviderError } from "@/server/ai/providers/types";

describe("what people are told when the AI service fails", () => {
  it("says to try again for busy, rate-limited or down", () => {
    for (const status of [429, 500, 502, 503, 529, undefined]) {
      const msg = describeAIError(new AIProviderError("x", "anthropic", true, status), "read your CV");
      expect(msg).toMatch(/busy right now/);
      expect(msg).toMatch(/try again/i);
    }
  });

  it("points the site owner at the key, billing and model when a retry can't help", () => {
    for (const status of [400, 401, 402, 403, 404]) {
      const msg = describeAIError(new AIProviderError("x", "anthropic", false, status), "create your Master documents");
      expect(msg).toContain(`error ${status}`);
      expect(msg).toMatch(/key, its billing and the model/);
    }
  });

  it("shows the service's own sentence to the site owner for a refusal", () => {
    const e = new AIProviderError("x", "anthropic", false, 400, undefined, "temperature is deprecated for this model");
    const msg = describeAIError(e, "create your Master documents");
    expect(msg).toContain("The service says: “temperature is deprecated for this model”");
    expect(msg).toContain("error 400");
  });

  it("names the out-of-credit case, which Anthropic reports as a 400", () => {
    const msg = describeAIError(new AIProviderError("x", "anthropic", false, 400, "no_credit"), "create your Master documents");
    expect(msg).toMatch(/out of credit/);
    expect(msg).toMatch(/Billing/);
    expect(msg).not.toMatch(/error 400/);
  });

  it("says the AI is not switched on when the key is missing", () => {
    expect(describeAIError(new AINotConfiguredError(), "read your CV")).toMatch(/isn't switched on/);
  });

  it("never repeats the vendor's raw message", () => {
    const e = new AIProviderError("Anthropic request failed (401) sk-ant-secret-looking-value", "anthropic", false, 401);
    expect(describeAIError(e)).not.toContain("sk-ant");
  });
});
