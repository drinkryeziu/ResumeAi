import { describe, expect, it, vi } from "vitest";
import { computeFit } from "@/server/ai/fit";
import { badInferredSkills, badTitleEquivalents, unsupportedCompetencies, unsupportedKeywordUse } from "@/server/ai/guard/fabrication-guard";
import { assembleResume, resumeText, skillSections } from "@/server/documents/model";
import { resumePlainText } from "@/server/documents/plain-text";
import { buildEvidence } from "@/server/ai/evidence";
import { sanitizeOptimized, type OptimizedResume } from "@/server/ai/workflows/resume-optimizer";
import type { MatchLabel, RequirementAssessment } from "@/server/ai/scoring";
import { statusOfLabel } from "@/server/ai/scoring";
import type { JobAnalysis, Requirement } from "@/server/ai/workflows/job-analyzer";
import { TEST_PROFILE } from "./fixtures";

vi.mock("server-only", () => ({}));
const { exportResume } = await import("@/server/documents/export");

const req = (id: string, importance: Requirement["importance"], over: Partial<Requirement> = {}): Requirement => ({
  id, text: `Requirement ${id}`, category: "skill", importance, keywords: [], measures: "none", years: null, subject: null, ...over,
});
const analysis = (...requirements: Requirement[]): JobAnalysis => ({
  title: "Designer", seniority: "senior", minYears: null, profession: null, industry: null, relatedIndustries: [], outcomes: [], summary: "", responsibilities: [], requirements, keywords: [],
});
const as = (id: string, label: MatchLabel, evidenceIds: string[] = ["x"]): RequirementAssessment => ({ requirementId: id, label, status: statusOfLabel(label), evidenceIds, explanation: "" });

describe("overall fit", () => {
  it("is excellent when every mandatory requirement is met and most preferred ones too", () => {
    const f = computeFit(analysis(req("a", "required"), req("b", "required"), req("c", "preferred")), [as("a", "strong"), as("b", "match"), as("c", "match")]);
    expect(f.overall).toBe("Excellent fit");
    expect(f.mandatory).toBe("Strong");
    expect(f.mandatoryGaps).toEqual([]);
  });

  it("never lets many preferred matches hide a mandatory gap", () => {
    const f = computeFit(
      analysis(req("m", "required", { text: "10+ years in Banking" }), req("p1", "preferred"), req("p2", "preferred"), req("p3", "preferred"), req("p4", "preferred")),
      [as("m", "none", []), as("p1", "strong"), as("p2", "strong"), as("p3", "strong"), as("p4", "strong")],
    );
    expect(f.preferred).toBe("Strong");
    expect(f.mandatory).toBe("Weak");
    expect(f.overall).not.toBe("Excellent fit");
    expect(f.overall).not.toBe("Strong fit");
    expect(f.mandatoryGaps).toEqual(["10+ years in Banking"]);
  });

  it("says there is not enough evidence when most requirements cannot be judged", () => {
    const f = computeFit(analysis(req("a", "required"), req("b", "required")), [as("a", "unknown", []), as("b", "unknown", [])]);
    expect(f.overall).toBe("Insufficient evidence");
  });

  it("reports each area on its own", () => {
    const f = computeFit(
      analysis(req("t", "required", { category: "tool" }), req("l", "required", { category: "leadership", measures: "leadership" }), req("i", "required", { category: "domain", measures: "industry" }), req("e", "required", { category: "education" })),
      [as("t", "strong"), as("l", "weak"), as("i", "partial"), as("e", "match")],
    );
    expect(f).toMatchObject({ technical: "Strong", leadership: "Weak", industry: "Partial", education: "Strong" });
  });
});

describe("skills inferred from the candidate's own words", () => {
  const evidence = buildEvidence(TEST_PROFILE);
  it("accepts a competency the responsibilities clearly show", () => {
    expect(badInferredSkills([{ name: "Mentoring", evidenceIds: ["exp_harbor#r3"] }], TEST_PROFILE, evidence)).toEqual([]);
  });
  it("rejects tools, certifications, languages and anything without evidence from the work", () => {
    expect(badInferredSkills([{ name: "Sketch 3.0", evidenceIds: ["exp_harbor#r0"] }], TEST_PROFILE, evidence)).toHaveLength(1);
    expect(badInferredSkills([{ name: "Certified Scrum Master", evidenceIds: ["exp_harbor#r0"] }], TEST_PROFILE, evidence)).toHaveLength(1);
    expect(badInferredSkills([{ name: "Stakeholder management", evidenceIds: [] }], TEST_PROFILE, evidence)).toHaveLength(1);
    expect(badInferredSkills([{ name: "Stakeholder management", evidenceIds: ["nope"] }], TEST_PROFILE, evidence)).toHaveLength(1);
  });
  it("drops invalid extras instead of failing the whole resume", () => {
    const out = {
      headline: "Senior Product Designer", summary: { text: "x", evidenceIds: ["summary"] }, experiences: [], skills: ["Figma"],
      coreCompetencies: ["Mentoring", "Design systems", "Kubernetes strategy", "Cross-functional collaboration", "Stakeholder management"],
      inferredSkills: [
        { name: "Mentoring", evidenceIds: ["exp_harbor#r3"], reason: "Mentors two designers." },
        { name: "Figma", evidenceIds: ["exp_harbor#r0"], reason: "Already listed." },
        { name: "Kubernetes 1.28", evidenceIds: ["exp_harbor#r0"], reason: "No." },
      ],
      titleEquivalents: [
        { experienceId: "exp_harbor", equivalent: "Product/UX Designer", evidenceIds: ["exp_harbor#r0"] },
        { experienceId: "exp_harbor", equivalent: "Director of Design", evidenceIds: ["exp_harbor#r0"] },
      ],
      educationIds: [], certificationIds: [], projects: [], changeNotes: [], questions: [],
    } satisfies OptimizedResume;
    const clean = sanitizeOptimized(TEST_PROFILE, out, ["Cross-functional collaboration"]);
    expect(clean.inferredSkills.map((s) => s.name)).toEqual(["Mentoring"]);
    // Core competencies: a listed skill, an inferred one with evidence, or a supported job term. Nothing else.
    expect(clean.coreCompetencies).toEqual(["Mentoring", "Design systems", "Cross-functional collaboration"]);
    expect(clean.titleEquivalents.map((t) => t.equivalent)).toEqual(["Product/UX Designer"]);
  });
});

describe("title equivalents keep the official title honest", () => {
  it("accepts a plain functional equivalent from the same role's evidence", () => {
    expect(badTitleEquivalents([{ experienceId: "exp_harbor", equivalent: "Senior Product/UX Designer", evidenceIds: ["exp_harbor#r0"] }], TEST_PROFILE)).toEqual([]);
  });
  it("rejects a claimed management or executive level, the employer's name, numbers and other roles' evidence", () => {
    const one = (equivalent: string, evidenceIds = ["exp_harbor#r0"]) => badTitleEquivalents([{ experienceId: "exp_harbor", equivalent, evidenceIds }], TEST_PROFILE);
    expect(one("Head of Design")).toHaveLength(1);
    expect(one("Design Manager")).toHaveLength(1);
    expect(one("Harbor Credit Union Designer")).toHaveLength(1);
    expect(one("Designer 5")).toHaveLength(1);
    expect(one("Product Designer", ["exp_lumen#r0"])).toHaveLength(1);
  });
});

describe("keywords without evidence stay out", () => {
  it("flags an unsupported job keyword in the resume text", () => {
    expect(unsupportedKeywordUse([{ text: "Led Kubernetes migrations", where: "summary" }], ["kubernetes"])).toHaveLength(1);
    expect(unsupportedKeywordUse([{ text: "Led design migrations", where: "summary" }], ["kubernetes"])).toEqual([]);
  });
});

describe("core competencies and technical skills", () => {
  it("are printed as two sections when the resume has competencies, and as one 'Skills' section otherwise", () => {
    expect(skillSections({ competencies: ["Team leadership", "UX research"], skills: ["Figma"] })).toEqual([
      { title: "Core competencies", items: ["Team leadership", "UX research"] },
      { title: "Technical skills", items: ["Figma"] },
    ]);
    expect(skillSections({ skills: ["Figma", "Miro"] })).toEqual([{ title: "Skills", items: ["Figma", "Miro"] }]);
    expect(skillSections({ competencies: [], skills: [] })).toEqual([]);
  });

  it("reach the resume text, the plain-text copy and both downloads", async () => {
    const doc = assembleResume(TEST_PROFILE, {
      headline: "Senior Product Designer", summary: "x", experiences: [], skills: ["Figma"], competencies: ["Team leadership"], educationIds: [], certificationIds: [], projects: [],
    });
    expect(doc.competencies).toEqual(["Team leadership"]);
    expect(resumeText(doc)).toContain("Team leadership");
    expect(resumePlainText(doc)).toMatch(/CORE COMPETENCIES\nTeam leadership\n\nTECHNICAL SKILLS\nFigma/);
    expect((await exportResume(doc, "pdf")).subarray(0, 4).toString()).toBe("%PDF");
    expect((await exportResume(doc, "docx")).subarray(0, 2).toString()).toBe("PK");
  });

  it("flags a competency nobody can vouch for", () => {
    expect(unsupportedCompetencies(["Figma", "Mentoring", "Blockchain strategy"], [{ name: "Mentoring" }], TEST_PROFILE)).toHaveLength(1);
  });
});
