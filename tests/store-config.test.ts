import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const KEYS = ["MONGODB_URI", "VERCEL", "ALLOW_MEMORY_STORE"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  delete (globalThis as { __resumeaiStore?: unknown }).__resumeaiStore;
});
const reset = () => KEYS.forEach((k) => delete process.env[k]);

describe("which store the app runs on", () => {
  it("uses MongoDB only when MONGODB_URI is set (blank counts as unset)", async () => {
    const { usesMongo } = await import("@/server/store/config");
    reset();
    expect(usesMongo()).toBe(false);
    process.env.MONGODB_URI = "   ";
    expect(usesMongo()).toBe(false);
    process.env.MONGODB_URI = "mongodb+srv://u:p@h/resumeai";
    expect(usesMongo()).toBe(true);
  });
});

describe("a deployment without a database", () => {
  it("refuses to run on Vercel without MONGODB_URI, with a message that says what to do", async () => {
    const { getStore } = await import("@/server/store");
    reset();
    process.env.VERCEL = "1";
    expect(() => getStore()).toThrow(/MONGODB_URI is not set/);
  });

  it("still runs locally, and on Vercel when explicitly allowed", async () => {
    const { getStore } = await import("@/server/store");
    reset();
    await expect(getStore()).resolves.toBeTruthy(); // local in-memory store
    delete (globalThis as { __resumeaiStore?: unknown }).__resumeaiStore;
    process.env.VERCEL = "1";
    process.env.ALLOW_MEMORY_STORE = "true";
    await expect(getStore()).resolves.toBeTruthy();
  });
});
