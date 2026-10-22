import { describe, expect, it } from "vitest";
import { MODEL_ROUTES } from "@/server/ai/routing";
import { resumeParser, sanitizeDraft, type ProfileDraft } from "@/server/ai/workflows/resume-parser";

// What comes out of a PDF: a ligature as one character, a bullet as a symbol, odd spacing and hyphenation.
const PDF_TEXT = `Alex Rivera
Senior Product Designer
Experience
Senior Product Designer — Harbor Credit Union  2019 – Present
 Led the ﬁrst redesign of the customer portal, used by 20 ,000 people
Education
BA Design, University of Berlin
Skills
Figma, User research, Design systems`;

const empty: ProfileDraft = {
  firstName: "Alex", lastName: "Rivera", headline: "Senior Product Designer", email: null, phone: null, location: null, links: [], summary: null,
  experiences: [], education: [], skills: [], certifications: [], projects: [], languages: [],
};
const exp = (source: string) => ({ company: "Harbor Credit Union", title: "Senior Product Designer", location: null, startDate: null, endDate: null, isCurrent: true, bullets: [], tools: [], source });

describe("reading a CV from PDF text", () => {
  it("accepts a quoted line that differs from the PDF only in ligatures, spacing, bullets and capitals", () => {
    const draft = { ...empty, experiences: [exp("Senior Product Designer - Harbor Credit Union 2019 - Present")], skills: [{ name: "figma", category: "TOOL" as const }, { name: "Design Systems", category: "PROFESSIONAL" as const }] };
    const out = sanitizeDraft(PDF_TEXT, draft);
    expect(out.experiences).toHaveLength(1);
    expect(out.skills.map((s) => s.name)).toEqual(["figma", "Design Systems"]);
    expect(resumeParser.check!({ text: PDF_TEXT }, out)).toEqual([]);
  });

  it("drops what the CV doesn't say, instead of throwing the whole reading away", () => {
    const draft = {
      ...empty,
      experiences: [exp("Senior Product Designer — Harbor Credit Union"), exp("Head of Design at Nowhere Inc 2010 – 2012")],
      skills: [{ name: "Figma", category: "TOOL" as const }, { name: "Kubernetes", category: "TECHNICAL" as const }, { name: "figma", category: "TOOL" as const }],
      languages: ["Klingon"],
    };
    const out = sanitizeDraft(PDF_TEXT, draft);
    expect(out.experiences.map((e) => e.source)).toEqual(["Senior Product Designer — Harbor Credit Union"]);
    expect(out.skills.map((s) => s.name)).toEqual(["Figma"]); // the made-up one and the repeat are gone
    expect(out.languages).toEqual([]);
    expect(resumeParser.check!({ text: PDF_TEXT }, out)).toEqual([]);
  });

  it("still refuses an invented item that gets past (the guard checks what is left)", () => {
    const bad = { ...empty, experiences: [exp("Head of Design at Nowhere Inc 2010 – 2012")] };
    expect(resumeParser.check!({ text: PDF_TEXT }, bad)).toHaveLength(1);
  });

  it("has room to write a whole CV out item by item", () => {
    expect(MODEL_ROUTES.resume_parser.maxTokens).toBeGreaterThanOrEqual(10_000);
  });
});
