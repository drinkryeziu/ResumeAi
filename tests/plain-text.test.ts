import { describe, expect, it } from "vitest";
import { TEST_PROFILE } from "./fixtures";
import { resumeFromProfile, type CoverLetterDocument } from "@/server/documents/model";
import { coverLetterPlainText, resumePlainText } from "@/server/documents/plain-text";

describe("copy as text", () => {
  it("writes a resume that contains only what the document holds, in reading order", () => {
    const doc = resumeFromProfile(TEST_PROFILE);
    const text = resumePlainText(doc);
    expect(text.startsWith(doc.header.name)).toBe(true);
    for (const e of doc.experience) {
      expect(text).toContain(`${e.title}, ${e.company}`);
      for (const b of e.bullets) expect(text).toContain(`- ${b}`);
    }
    expect(text.indexOf("EXPERIENCE")).toBeGreaterThan(text.indexOf(doc.header.name));
    expect(text).toContain(doc.skills.join(", "));
    expect(text).not.toMatch(/undefined|null/);
  });

  it("writes a cover letter with greeting, paragraphs and signature", () => {
    const doc: CoverLetterDocument = {
      sender: { name: "Alex Rivera", email: "alex@example.com", phone: null, location: "Charlotte, NC" },
      recipient: { company: "Northwind", jobTitle: "Designer" },
      date: "2026-10-19",
      greeting: "Dear Hiring Team,",
      paragraphs: ["First paragraph.", "Second paragraph."],
      closing: "Sincerely,",
      signature: "Alex Rivera",
    };
    const text = coverLetterPlainText(doc);
    expect(text).toContain("October 19, 2026");
    expect(text).toContain("Dear Hiring Team,\n\nFirst paragraph.\n\nSecond paragraph.\n\nSincerely,\nAlex Rivera");
    expect(text).not.toMatch(/undefined|null/);
  });
});
