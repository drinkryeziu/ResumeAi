import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { coverLetterGenerator, masterCoverLetter, toCoverLetterDocument } = await import("@/server/ai/workflows/cover-letter");
const { resumeFromProfile } = await import("@/server/documents/model");
const { coverLetterPlainText } = await import("@/server/documents/plain-text");
const { TEST_JOB, TEST_PROFILE } = await import("./fixtures");

const input = { profile: TEST_PROFILE, resume: resumeFromProfile(TEST_PROFILE), job: TEST_JOB, analysis: null, tone: "PROFESSIONAL" as const, mode: "generate" as const };

describe("cover letter instructions and layout", () => {
  it("tells the writer to analyze the job and the candidate, stay evidence-only and aim for 250–400 words", () => {
    const { system } = coverLetterGenerator.prompt(input);
    expect(system).toMatch(/exact title/i);
    expect(system).toMatch(/Relevance beats chronology/);
    expect(system).toMatch(/never round up, add or estimate a number/i);
    expect(system).toMatch(/never claim an industry/i);
    expect(system).toMatch(/no outside knowledge/i);
    expect(system).toMatch(/never output the analysis/i);
    expect(system).toMatch(/never over 400/);
  });

  it("gives the Master letter the same craft rules without naming a company", () => {
    const { system } = masterCoverLetter.prompt({ ...input, job: null });
    expect(system).toMatch(/Relevance beats chronology/);
    expect(system).toMatch(/Do not name a company/);
  });

  it("greets 'Dear Hiring Manager,' (no manager is invented) and lists email, phone, location, LinkedIn and portfolio", () => {
    const doc = toCoverLetterDocument(input, { paragraphs: [{ text: "One.", evidenceIds: ["summary"] }], organizationsMentioned: [] });
    expect(doc.greeting).toBe("Dear Hiring Manager,");
    expect(doc.sender.links).toEqual(["linkedin.com/in/alex-rivera", "alexrivera.example.com"]);
    const text = coverLetterPlainText(doc);
    expect(text).toContain("linkedin.com/in/alex-rivera");
    expect(text).toContain("alexrivera.example.com");
  });

  it("leaves out links the profile does not have", () => {
    const profile = { ...TEST_PROFILE, links: {} };
    const doc = toCoverLetterDocument({ ...input, profile }, { paragraphs: [], organizationsMentioned: [] });
    expect(doc.sender.links).toEqual([]);
  });
});
