import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const KEYS = ["AI_FORCE_MOCK", "AI_ALLOW_MOCK", "ANTHROPIC_API_KEY"] as const;
afterEach(() => {
  vi.unstubAllEnvs();
  for (const k of KEYS) delete process.env[k];
});
const clean = () => KEYS.forEach((k) => delete process.env[k]);

describe("the sample writer is not used on a production site", () => {
  it("refuses, with a clear error, when production has no AI key", async () => {
    const { resolveProvider } = await import("@/server/ai/providers/registry");
    const { AINotConfiguredError } = await import("@/server/ai/providers/types");
    const { MODEL_ROUTES } = await import("@/server/ai/routing");
    clean();
    vi.stubEnv("NODE_ENV", "production");
    expect(() => resolveProvider(MODEL_ROUTES.cover_letter, () => ({}))).toThrow(AINotConfiguredError);
  });

  it("still works in development and tests, and when explicitly allowed", async () => {
    const { resolveProvider } = await import("@/server/ai/providers/registry");
    const { MODEL_ROUTES } = await import("@/server/ai/routing");
    clean();
    vi.stubEnv("NODE_ENV", "development");
    expect(resolveProvider(MODEL_ROUTES.cover_letter, () => ({})).model).toBe("mock");
    vi.stubEnv("NODE_ENV", "production");
    process.env.AI_ALLOW_MOCK = "true";
    expect(resolveProvider(MODEL_ROUTES.cover_letter, () => ({})).model).toBe("mock");
    delete process.env.AI_ALLOW_MOCK;
    process.env.AI_FORCE_MOCK = "true";
    expect(resolveProvider(MODEL_ROUTES.cover_letter, () => ({})).model).toBe("mock");
  });

  it("uses the real model when the key is set", async () => {
    const { resolveProvider } = await import("@/server/ai/providers/registry");
    const { MODEL_ROUTES } = await import("@/server/ai/routing");
    clean();
    vi.stubEnv("NODE_ENV", "production");
    process.env.ANTHROPIC_API_KEY = "sk-test-not-real";
    expect(resolveProvider(MODEL_ROUTES.cover_letter, () => ({})).model).toBe(MODEL_ROUTES.cover_letter.model);
  });

  it("charges nothing when an AI action can't run", async () => {
    const { MemoryAppStore } = await import("@/server/store/memory");
    const { AINotConfiguredError } = await import("@/server/ai/providers/types");
    const pipeline = await import("@/server/services/job-pipeline");
    const { seedTestUser, TEST_JOB } = await import("./fixtures");
    const store = new MemoryAppStore();
    const u = await seedTestUser(store);
    clean();
    vi.stubEnv("NODE_ENV", "production");
    const job = await pipeline.createJob(store, u, TEST_JOB);
    const before = await store.credits.balance(u);
    await expect(pipeline.analyzeJob(store, u, job.id, "r1")).rejects.toBeInstanceOf(AINotConfiguredError);
    expect(await store.credits.balance(u)).toBe(before);
  });

  it("is reported by the health check in words", async () => {
    const { setupStatus } = await import("@/server/store/setup-check");
    clean();
    vi.stubEnv("NODE_ENV", "production");
    process.env.AUTH_SECRET = "x".repeat(32);
    const missing = await setupStatus();
    expect(missing).toMatchObject({ ai: false, ready: false });
    expect(missing.problems.join(" ")).toMatch(/ANTHROPIC_API_KEY is missing/);
    process.env.ANTHROPIC_API_KEY = "sk-test-not-real";
    const ok = await setupStatus();
    expect(ok).toMatchObject({ ai: true, ready: true });
    expect(JSON.stringify(ok)).not.toContain("sk-test-not-real");
  });
});
