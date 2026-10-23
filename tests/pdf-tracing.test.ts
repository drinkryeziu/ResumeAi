import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

// The PDF writer loads its Helvetica font files by name at run time, which Vercel's file tracing cannot see. If the download route
// does not list them, the deployed PDF download fails with a 500 while Word still works (it did once).
describe("PDF download on Vercel", () => {
  it("keeps the PDF writer's font files with the download route", () => {
    const includes = nextConfig.outputFileTracingIncludes?.["/api/jobs/[jobId]/download"] ?? [];
    expect(includes.some((g) => g.includes("pdfkit/js/standard-fonts"))).toBe(true);
    for (const f of ["Helvetica", "HelveticaBold"]) expect(existsSync(`node_modules/pdfkit/js/standard-fonts/${f}.cjs`)).toBe(true);
  });
});
