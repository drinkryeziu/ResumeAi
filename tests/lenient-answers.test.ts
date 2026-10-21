import { describe, expect, it } from "vitest";
import { sanitizeAnalysis, JobAnalysisSchema } from "@/server/ai/workflows/job-analyzer";
import { checkOptimizedResume, OptimizedResumeSchema, sanitizeOptimized } from "@/server/ai/workflows/resume-optimizer";
import { CoverLetterSchema, sanitizeLetter, type CoverLetterInput } from "@/server/ai/workflows/cover-letter";
import { resumeFromProfile } from "@/server/documents/model";
import { TEST_PROFILE } from "./fixtures";

/** An answer with every kind of slip a model makes: too many items, unknown ids, another role's evidence, an invented number. */
const sloppy = () =>
  OptimizedResumeSchema.parse({
    headline: "Senior Product Designer | UX Strategy",
    summary: { text: "Designer who raised conversion by 80% across 40+ markets.", evidenceIds: ["summary"] },
    experiences: [
      {
        experienceId: "exp_harbor",
        bullets: [
          { text: "Raised account opening completion from 41% to 63%.", evidenceIds: ["exp_harbor#a0"] }, // fine
          { text: "Raised conversion by 80%.", evidenceIds: ["exp_harbor#a0"] }, // 80% is not in the evidence
          { text: "Built a design system.", evidenceIds: ["exp_lumen#a0"] }, // another role's evidence
          { text: "Made things.", evidenceIds: ["nope"] }, // evidence that doesn't exist
          ...Array.from({ length: 8 }, (_, i) => ({ text: `Mentored designers (${i}).`, evidenceIds: ["exp_harbor#r3"] })), // far too many
        ],
      },
      { experienceId: "exp_ghost", bullets: [{ text: "Never worked here.", evidenceIds: ["exp_ghost"] }] },
    ],
    coreCompetencies: Array.from({ length: 20 }, (_, i) => `Skill ${i}`),
    skills: ["Figma", "Kubernetes"],
    inferredSkills: [],
    titleEquivalents: [],
    educationIds: [],
    certificationIds: ["cert_made_up"],
    projects: [],
    changeNotes: Array.from({ length: 12 }, (_, i) => `note ${i}`),
    questions: [],
  });

describe("an answer that is almost right is made right, never refunded and never believed", () => {
  it("is accepted by the schema however many items the model wrote", () => {
    expect(sloppy().experiences[0]!.bullets).toHaveLength(12);
  });

  it("is corrected so that every guard passes", () => {
    const clean = sanitizeOptimized(TEST_PROFILE, sloppy());
    expect(checkOptimizedResume(TEST_PROFILE, clean)).toEqual([]);
    expect(clean.headline).toBe(TEST_PROFILE.headline);
    expect(clean.experiences.map((e) => e.experienceId)).toEqual(["exp_harbor"]); // the role that doesn't exist is gone
    const texts = clean.experiences[0]!.bullets.map((b) => b.text);
    expect(texts[0]).toBe("Raised account opening completion from 41% to 63%.");
    expect(texts.join(" ")).not.toMatch(/80%|design system\.|Made things/); // invented number, foreign evidence, missing evidence: dropped
    expect(texts).toHaveLength(6); // cut to size
    expect(clean.summary).toEqual({ text: TEST_PROFILE.summary!.trim(), evidenceIds: ["summary"] }); // an unsupported summary becomes the candidate's own
    expect(clean.skills).toEqual(["Figma"]);
    expect(clean.coreCompetencies).toEqual([]);
    expect(clean.educationIds).toEqual(TEST_PROFILE.education.map((e) => e.id)); // left out or wrong: filled from the profile
    expect(clean.certificationIds).toEqual(TEST_PROFILE.certifications.map((c) => c.id));
    expect(clean.changeNotes).toHaveLength(8);
  });

  it("gives a role its own words back when none of the model's bullets can be used", () => {
    const out = sloppy();
    out.experiences[0]!.bullets = [{ text: "Raised conversion by 80%.", evidenceIds: ["exp_harbor#a0"] }];
    const clean = sanitizeOptimized(TEST_PROFILE, out);
    const harbor = TEST_PROFILE.experiences.find((e) => e.id === "exp_harbor")!;
    expect(clean.experiences[0]!.bullets[0]).toEqual({ text: harbor.achievements[0], evidenceIds: ["exp_harbor#a0"] });
    expect(checkOptimizedResume(TEST_PROFILE, clean)).toEqual([]);
  });

  it("restores every role when the model returned none that exist", () => {
    const out = sloppy();
    out.experiences = [{ experienceId: "exp_ghost", bullets: [] }];
    const clean = sanitizeOptimized(TEST_PROFILE, out);
    expect(clean.experiences.map((e) => e.experienceId)).toEqual(TEST_PROFILE.experiences.map((e) => e.id));
    expect(checkOptimizedResume(TEST_PROFILE, clean)).toEqual([]);
  });
});

describe("a cover letter that slips is trimmed, or replaced by the plain template", () => {
  const input = (): CoverLetterInput => ({ profile: TEST_PROFILE, resume: resumeFromProfile(TEST_PROFILE), job: { title: "Designer", company: "Northwind Financial", description: "x" }, analysis: null, tone: "PROFESSIONAL", mode: "generate" });
  const letter = (paragraphs: Array<{ text: string; evidenceIds: string[] }>, organizationsMentioned: string[] = []) => CoverLetterSchema.parse({ paragraphs, organizationsMentioned });

  it("drops paragraphs with unsupported numbers, unknown evidence or an unknown employer", () => {
    const out = sanitizeLetter(
      input(),
      letter(
        [
          { text: "I lead design at Harbor Credit Union and love Northwind Financial.", evidenceIds: ["exp_harbor"] },
          { text: "I raised revenue by 300%.", evidenceIds: ["exp_harbor#a0"] },
          { text: "I also worked at Globex Corp.", evidenceIds: ["exp_harbor"] },
          { text: "Something with no source.", evidenceIds: ["nope"] },
          { text: "I run research sessions with members each quarter.", evidenceIds: ["exp_harbor#r1"] },
        ],
        ["Harbor Credit Union", "Globex Corp", "Figma"],
      ),
    );
    expect(out.paragraphs.map((p) => p.text)).toEqual(["I lead design at Harbor Credit Union and love Northwind Financial.", "I run research sessions with members each quarter."]);
    expect(out.organizationsMentioned).toEqual(["Harbor Credit Union", "Figma"]); // a tool the candidate lists is not an invented employer
  });

  it("falls back to the template when fewer than two paragraphs survive", () => {
    const out = sanitizeLetter(input(), letter([{ text: "I raised revenue by 300%.", evidenceIds: ["exp_harbor#a0"] }]));
    expect(out.paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(out.paragraphs.join(" ")).not.toMatch(/300%/);
  });
});

describe("a job analysis is accepted whatever the model overshoots", () => {
  it("fixes unknown enum values, long lists, missing numbers and repeated ids", () => {
    const raw = {
      title: "Designer",
      seniority: "super-senior",
      minYears: "5",
      profession: null,
      industry: undefined,
      relatedIndustries: Array.from({ length: 12 }, (_, i) => `I${i}`),
      outcomes: [],
      summary: "x",
      responsibilities: Array.from({ length: 20 }, (_, i) => `R${i}`),
      requirements: Array.from({ length: 40 }, (_, i) => ({ id: i < 2 ? "r1" : `r${i + 1}`, text: `Req ${i}`, category: "technical_skill", importance: "must", keywords: ["a"], measures: "mix", years: "5", subject: 3 })),
      keywords: [{ term: "Figma", count: 0, importance: "very high" }],
    };
    const parsed = JobAnalysisSchema.parse(raw);
    expect(parsed.requirements[0]).toMatchObject({ category: "skill", importance: "required", measures: "none", years: null });
    const clean = sanitizeAnalysis(parsed);
    expect(clean.requirements).toHaveLength(30);
    expect(new Set(clean.requirements.map((r) => r.id)).size).toBe(30);
    expect(clean.responsibilities).toHaveLength(12);
    expect(clean.relatedIndustries).toHaveLength(8);
    expect(clean.keywords[0]).toMatchObject({ term: "Figma", count: 1, importance: "medium" });
    expect(clean.seniority).toBe("unspecified");
  });
});
