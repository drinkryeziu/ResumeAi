import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const KEYS = ["AUTH_SECRET", "MONGODB_URI", "VERCEL"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  vi.unstubAllEnvs();
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
const env = (v: Partial<Record<(typeof KEYS)[number], string>>) => {
  KEYS.forEach((k) => delete process.env[k]);
  Object.assign(process.env, v);
};

describe("setup check (what /api/health reports)", () => {
  it("says exactly what a Vercel site is missing, in words", async () => {
    const { setupStatus } = await import("@/server/store/setup-check");
    vi.stubEnv("NODE_ENV", "production");
    env({ VERCEL: "1" });
    const s = await setupStatus();
    expect(s).toMatchObject({ authSecret: false, mongodbUri: false, database: "in-memory", onVercel: true, ready: false });
    expect(s.problems.join(" ")).toMatch(/AUTH_SECRET is missing/);
    expect(s.problems.join(" ")).toMatch(/MONGODB_URI is missing/);
  });

  it("treats a blank AUTH_SECRET as missing", async () => {
    const { setupStatus } = await import("@/server/store/setup-check");
    vi.stubEnv("NODE_ENV", "production");
    env({ VERCEL: "1", AUTH_SECRET: "   ", MONGODB_URI: "" });
    expect((await setupStatus()).authSecret).toBe(false);
  });

  it("does not raise a false alarm in local development, where a dev secret is filled in automatically", async () => {
    const { setupStatus } = await import("@/server/store/setup-check");
    env({});
    expect((await setupStatus()).authSecret).toBe(true);
  });

  it("is ready locally on the in-memory store once there is a secret, and never reveals values", async () => {
    const { setupStatus } = await import("@/server/store/setup-check");
    env({ AUTH_SECRET: "super-secret-value-123" });
    const s = await setupStatus();
    expect(s).toMatchObject({ authSecret: true, mongodbUri: false, database: "in-memory", onVercel: false, ready: true, problems: [] });
    expect(JSON.stringify(s)).not.toContain("super-secret-value-123");
  });

  it("reports an unreachable database as failed, without echoing the connection string", async () => {
    const { setupStatus } = await import("@/server/store/setup-check");
    vi.stubEnv("NODE_ENV", "production");
    env({ AUTH_SECRET: "x".repeat(32), MONGODB_URI: "mongodb://user:hunter2pw@127.0.0.1:1/resumeai?serverSelectionTimeoutMS=300" });
    const s = await setupStatus({ pingTimeoutMs: 1500 });
    expect(s).toMatchObject({ mongodbUri: true, database: "failed", ready: false });
    expect(JSON.stringify(s)).not.toContain("hunter2pw");
    expect(s.problems.join(" ")).toMatch(/could not be reached/);
    delete (globalThis as { __resumeaiMongo?: unknown }).__resumeaiMongo;
  });
});
