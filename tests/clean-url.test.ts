import { describe, expect, it } from "vitest";
import { cleanJobUrl } from "@/lib/clean-url";

describe("the job posting link", () => {
  it("adds https:// when people leave it off", () => {
    expect(cleanJobUrl("linkedin.com/jobs/view/123")).toBe("https://linkedin.com/jobs/view/123");
    expect(cleanJobUrl("  www.example.com/careers/ux ")).toBe("https://www.example.com/careers/ux");
    expect(cleanJobUrl("http://example.com/job")).toBe("http://example.com/job");
    expect(cleanJobUrl("HTTPS://Example.com/Job")).toBe("HTTPS://Example.com/Job");
  });

  it("never blocks: an empty or unusable link just becomes no link", () => {
    for (const bad of ["", "   ", undefined, null, "not a link", "javascript:alert(1)", "ftp://example.com/a", "mailto:a@b.com", "localhost"])
      expect(cleanJobUrl(bad)).toBe("");
  });

  it("keeps it to a sane length", () => {
    expect(cleanJobUrl(`example.com/${"a".repeat(5000)}`).length).toBeLessThanOrEqual(2000);
  });
});
