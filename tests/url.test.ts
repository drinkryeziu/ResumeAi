import { describe, expect, it } from "vitest";
import { normalizeUrl } from "@/lib/url";
import { ProfileInputSchema } from "@/server/domain/profile-schema";
import { toProfileInput } from "@/server/domain/profile-mapping";
import { TEST_PROFILE } from "./fixtures";

describe("normalizeUrl", () => {
  it("completes professional profile addresses", () => {
    expect(normalizeUrl("linkedin.com/in/alex-rivera")).toBe("https://www.linkedin.com/in/alex-rivera");
    expect(normalizeUrl("www.linkedin.com/in/alex-rivera")).toBe("https://www.linkedin.com/in/alex-rivera");
    expect(normalizeUrl("github.com/alexr")).toBe("https://github.com/alexr");
    expect(normalizeUrl("gitlab.com/alexr/tools")).toBe("https://gitlab.com/alexr/tools");
  });

  it("adds https only, keeping the host, path, query and case as typed", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("www.example.com")).toBe("https://www.example.com");
    expect(normalizeUrl("portfolio.alexrivera.dev/Case-Studies?x=1#top")).toBe("https://portfolio.alexrivera.dev/Case-Studies?x=1#top");
    expect(normalizeUrl("  https://example.com/Work/  ")).toBe("https://example.com/Work/");
    expect(normalizeUrl("http://example.com/a")).toBe("http://example.com/a");
  });

  it("leaves anything that is not a web address alone", () => {
    expect(normalizeUrl("")).toBe("");
    expect(normalizeUrl("my portfolio")).toBe("my portfolio");
    expect(normalizeUrl("localhost")).toBe("localhost");
    expect(normalizeUrl("javascript://x")).toBe("javascript://x");
    expect(normalizeUrl("ftp://example.com")).toBe("ftp://example.com");
  });

  it("is applied when a profile is saved", () => {
    const input = toProfileInput(TEST_PROFILE, "alex@example.com", "");
    const parsed = ProfileInputSchema.safeParse({ ...input, links: { ...input.links, linkedin: "linkedin.com/in/alex", github: "github.com/alex", website: "" } });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.links).toMatchObject({ linkedin: "https://www.linkedin.com/in/alex", github: "https://github.com/alex", website: "" });
  });

  it("still rejects something that is clearly not an address", () => {
    const input = toProfileInput(TEST_PROFILE, "alex@example.com", "");
    expect(ProfileInputSchema.safeParse({ ...input, links: { ...input.links, website: "not an address" } }).success).toBe(false);
  });
});
