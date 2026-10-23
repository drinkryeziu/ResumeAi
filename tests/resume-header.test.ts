import { describe, expect, it, vi } from "vitest";
import { cityStateOf, headerLines, resumeFromProfile, senderLines } from "@/server/documents/model";
import { coverLetterPlainText, resumePlainText } from "@/server/documents/plain-text";
import { toCoverLetterDocument } from "@/server/ai/workflows/cover-letter";
import { TEST_PROFILE } from "./fixtures";

vi.mock("server-only", () => ({}));

describe("the resume header", () => {
  const profile = { ...TEST_PROFILE, phone: "+1 929 354 3643", city: "Cornelius", state: "NC", country: "United States", links: { linkedin: "https://www.linkedin.com/in/ana", portfolio: "https://ana.example.com" } };

  it("puts city and state, not the country, on the place line", () => {
    expect(cityStateOf({ city: "Cornelius", state: "NC", country: "United States" })).toBe("Cornelius, NC");
    expect(cityStateOf({ city: "Berlin", state: null, country: "Germany" })).toBe("Berlin, Germany");
    expect(cityStateOf({ city: null, state: null, country: "Germany" })).toBe("Germany");
    expect(cityStateOf({ city: "Cornelius", state: null, country: null })).toBe("Cornelius");
    expect(cityStateOf({ city: null, state: null, country: null })).toBeNull();
  });

  it("is one fact per line: name, job title, phone and email, city and state, then the links", () => {
    const doc = resumeFromProfile(profile);
    const head = headerLines(doc.header);
    expect(head.name).toBe("Alex Rivera");
    expect(head.contact).toBe("+1 929 354 3643  |  alex.rivera@example.com");
    expect(head.place).toBe("Cornelius, NC");
    expect(head.links.map((l) => l.text)).toEqual(["linkedin.com/in/ana", "ana.example.com"]);
  });

  it("leaves out a line it has nothing for", () => {
    const head = headerLines(resumeFromProfile({ ...profile, phone: null, city: null, state: null, country: null, links: {} }).header);
    expect(head.contact).toBe("alex.rivera@example.com");
    expect(head.place).toBe("");
    expect(head.links).toEqual([]);
  });

  it("is copied as text in the same order, line by line", () => {
    const text = resumePlainText(resumeFromProfile(profile));
    const top = text.split("\n").slice(0, 5);
    expect(top[0]).toBe("Alex Rivera");
    expect(top[1]).toBe(resumeFromProfile(profile).header.headline);
    expect(top[2]).toBe("+1 929 354 3643  |  alex.rivera@example.com");
    expect(top[3]).toBe("Cornelius, NC");
    expect(top[4]).toBe("linkedin.com/in/ana  |  ana.example.com");
  });
});

describe("the cover letter's top block", () => {
  const profile = { ...TEST_PROFILE, phone: "+1 929 354 3643", city: "Cornelius", state: "NC", country: "United States", links: { linkedin: "https://www.linkedin.com/in/ana", portfolio: "https://ana.example.com" } };
  const resume = resumeFromProfile(profile);
  const letter = (job: { title: string; company: string; description: string } | null = null) =>
    toCoverLetterDocument({ profile, resume, job, analysis: null, tone: "PROFESSIONAL", mode: "generate" }, { paragraphs: [{ text: "Hello.", evidenceIds: ["summary"] }], organizationsMentioned: [] });

  it("has the resume's own order and job title: name, title, phone | email, city and state, links", () => {
    const from = senderLines(letter().sender);
    expect(from.name).toBe("Alex Rivera");
    expect(from.headline).toBe(resume.header.headline);
    expect(from.contact).toBe("+1 929 354 3643  |  alex.rivera@example.com");
    expect(from.place).toBe("Cornelius, NC");
    expect(from.links).toEqual(["linkedin.com/in/ana", "ana.example.com"]);
  });

  it("is the same for the Master Cover Letter (no job) and one written for a job", () => {
    const master = senderLines(letter(null).sender);
    const forJob = senderLines(letter({ title: "Designer", company: "Northwind", description: "d" }).sender);
    expect(master).toEqual(forJob);
  });

  it("is copied as text in that order, then the date and the letter", () => {
    const lines = coverLetterPlainText(letter()).split("\n");
    expect(lines.slice(0, 5)).toEqual(["Alex Rivera", resume.header.headline, "+1 929 354 3643  |  alex.rivera@example.com", "Cornelius, NC", "linkedin.com/in/ana  |  ana.example.com"]);
    expect(lines[5]).toBe("");
  });

  it("still reads an older letter that has no job title line", () => {
    const old = { ...letter().sender, headline: undefined };
    expect(senderLines(old).headline).toBe("");
    expect(coverLetterPlainText({ ...letter(), sender: old }).split("\n")[1]).toBe("+1 929 354 3643  |  alex.rivera@example.com");
  });
});
