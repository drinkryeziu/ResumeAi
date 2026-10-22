import { describe, expect, it } from "vitest";
import { cleanMessage, cleanPath, groupErrors, sourceLabel, type ErrorEntry } from "@/server/admin/errors";
import { recordError } from "@/server/admin/record-error";
import { MemoryAppStore } from "@/server/store/memory";

const e = (over: Partial<ErrorEntry>): ErrorEntry => ({ id: Math.random().toString(36), at: new Date("2026-10-22T10:00:00Z"), source: "cv_upload", code: "scanned", message: "m", userId: "u1", ...over });

describe("error log messages", () => {
  it("masks emails, links and phone numbers, and keeps the rest", () => {
    expect(cleanMessage("Failed for ana@example.com at https://x.test/reset?token=abc and +1 (555) 123-4567: boom")).toBe("Failed for [email] at [link] and [number]: boom");
    expect(cleanMessage("   too   many   spaces ")).toBe("too many spaces");
    expect(cleanMessage("x".repeat(500))).toHaveLength(300);
  });

  it("keeps only the page path, never the query string or fragment (a reset link carries a token)", () => {
    expect(cleanPath("/reset-password?token=secret#x")).toBe("/reset-password");
    expect(cleanPath(undefined)).toBeUndefined();
  });

  it("names the places errors come from in plain words", () => {
    expect(sourceLabel("cv_upload")).toBe("CV upload");
    expect(sourceLabel("something_new")).toBe("something_new");
  });
});

describe("grouping errors", () => {
  it("makes one row per problem with its count, people and times, the latest first", () => {
    const groups = groupErrors([
      e({ at: new Date("2026-10-20T10:00:00Z"), userId: "u1", message: "old" }),
      e({ at: new Date("2026-10-22T09:00:00Z"), userId: "u2", message: "newest" }),
      e({ at: new Date("2026-10-21T10:00:00Z"), userId: "u1" }),
      e({ at: new Date("2026-10-21T12:00:00Z"), userId: null }),
      e({ source: "analyze_job", code: "ai_busy", at: new Date("2026-10-23T08:00:00Z"), userId: "u3" }),
    ]);
    expect(groups.map((g) => `${g.source}/${g.code}`)).toEqual(["analyze_job/ai_busy", "cv_upload/scanned"]);
    const cv = groups[1]!;
    expect(cv).toMatchObject({ count: 4, people: 2, message: "newest" });
    expect(cv.firstAt.toISOString()).toBe("2026-10-20T10:00:00.000Z");
    expect(cv.lastAt.toISOString()).toBe("2026-10-22T09:00:00.000Z");
  });

  it("is empty when nothing went wrong", () => {
    expect(groupErrors([])).toEqual([]);
  });
});

describe("recording an error", () => {
  it("stores a cleaned entry and never throws, even when the store fails", async () => {
    const store = new MemoryAppStore();
    await recordError(store, { source: "cv_upload", code: "empty", message: "File from bob@example.com was empty", userId: "u1", path: "/onboarding?x=1" });
    const { entries } = await store.errorSummary(new Date(0));
    expect(entries[0]).toMatchObject({ source: "cv_upload", code: "empty", message: "File from [email] was empty", userId: "u1", path: "/onboarding" });
    const broken = { recordError: async () => { throw new Error("db down"); } };
    await expect(recordError(broken, { source: "x", code: "y", message: "z" })).resolves.toBeUndefined();
  });
});
