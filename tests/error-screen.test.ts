import { describe, expect, it } from "vitest";
import { isStaleDeployError } from "@/components/features/errors/ErrorScreen";

describe("stale page after an update", () => {
  it("recognizes the errors a page gets when its files were replaced by a new version", () => {
    const named = Object.assign(new Error("x"), { name: "ChunkLoadError" });
    expect(isStaleDeployError(named)).toBe(true);
    expect(isStaleDeployError(new Error("Loading chunk 123 failed."))).toBe(true);
    expect(isStaleDeployError(new Error("Failed to find Server Action \"abc\". This request might be from an older or newer deployment."))).toBe(true);
    expect(isStaleDeployError(new Error("Failed to fetch dynamically imported module: https://x/_next/static/chunks/1.js"))).toBe(true);
  });
  it("does not hide real bugs behind a reload", () => {
    expect(isStaleDeployError(new TypeError("Cannot read properties of undefined (reading 'length')"))).toBe(false);
  });
});
