import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { MemoryAppStore } = await import("@/server/store/memory");
const { ipFrom, overLimit, RULES, subjectOf } = await import("@/server/security/rate-limit");

describe("rate limits", () => {
  it("allows the limit and blocks the next try, until the window is over", async () => {
    const store = new MemoryAppStore();
    const t = new Date("2026-05-01T10:00:00Z");
    const rule = RULES.signUpIp;
    for (let i = 0; i < rule.limit; i++) expect(await overLimit(store, rule, "1.2.3.4", t)).toBe(false);
    expect(await overLimit(store, rule, "1.2.3.4", t)).toBe(true);
    expect(await overLimit(store, rule, "5.6.7.8", t)).toBe(false); // someone else is unaffected
    expect(await overLimit(store, rule, "1.2.3.4", new Date(+t + rule.windowMs + 1000))).toBe(false); // a new window
  });

  it("keeps working if the counter breaks, so nobody is locked out by a database hiccup", async () => {
    const store = new MemoryAppStore();
    store.hitRateLimit = async () => {
      throw new Error("db down");
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await overLimit(store, RULES.signInIp, "x")).toBe(false);
    log.mockRestore();
  });

  it("reads the caller's address and never stores a readable email", () => {
    expect(ipFrom(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(ipFrom(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(ipFrom(new Headers())).toBe("unknown");
    expect(subjectOf(" Ada@Example.com ")).toBe(subjectOf("ada@example.com"));
    expect(subjectOf("ada@example.com")).not.toContain("ada");
  });
});
