import { describe, expect, it, vi } from "vitest";
import { computeFit } from "@/server/ai/fit";
import { badInferredSkills, badTitleEquivalents, unsupportedCompetencies, unsupportedKeywordUse } from "@/server/ai/guard/fabrication-guard";
import { assembleResume, resumeText, skillSections } from "@/server/documents/model";
import { resumePlainText } from "@/server/documents/plain-text";
import { buildEvidence } from "@/server/ai/evidence";
import { sanitizeOptimized, type OptimizedResume } from "@/server/ai/workflows/resume-optimizer";
import { sanitizeMatch, type MatchModelOutput } from "@/server/ai/workflows/candidate-match";
import type { MatchLabel, RequirementAssessment } from "@/server/ai/scoring";
import { statusOfLabel } from "@/server/ai/scoring";
import { experienceYears } from "@/server/ai/experience";
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

describe("a slip in bookkeeping does not block the analysis", () => {
  const job = (): JobAnalysis => ({
    ...analysis(req("r1", "required"), req("r2", "required")),
    keywords: [{ term: "Cross-functional collaboration", count: 2, importance: "high" }],
  });
  const slipped: MatchModelOutput = {
    roles: [{ experienceId: "exp_harbor", profession: "Product design", industry: "Banking", professionFit: "same", industryFit: "direct", leadership: "people" }, { experienceId: "ghost", profession: "x", industry: "y", professionFit: "same", industryFit: "direct", leadership: "none" }],
    titleGroups: [{ name: "Design", experienceIds: ["exp_harbor", "ghost"], reason: "x" }],
    assessments: [{ requirementId: "r1", label: "strong", evidenceIds: ["nope"], explanation: "x", qualifyingRoleIds: ["exp_harbor", "ghost"], relatedRoleIds: [], yearsDeterminable: true }, { requirementId: "zzz", label: "match", evidenceIds: ["exp_harbor"], explanation: "x", qualifyingRoleIds: [], relatedRoleIds: [], yearsDeterminable: true }],
    questions: [{ requirementId: "zzz", question: "?" }, { requirementId: "r1", question: "Have you done X?" }],
    supportedKeywords: [{ term: "cross functional collaboration", evidenceIds: ["exp_harbor#r2", "nope"], reason: "Works with PMs." }, { term: "Not a job keyword", evidenceIds: ["exp_harbor#r2"], reason: "x" }],
  };

  it("drops what is invalid and fills what is missing, the cautious way", () => {
    const out = sanitizeMatch({ profile: TEST_PROFILE, analysis: job() }, slipped);
    expect(out.roles.map((r) => r.experienceId).sort()).toEqual(TEST_PROFILE.experiences.map((e) => e.id).sort()); // every role tagged; the unknown one dropped
    expect(out.titleGroups).toEqual([]);
    expect(out.assessments.map((a) => [a.requirementId, a.label])).toEqual([["r1", "unknown"], ["r2", "unknown"]]); // cited nothing real → cannot determine; missing → cannot determine
    expect(out.assessments[0]!.qualifyingRoleIds).toEqual(["exp_harbor"]);
    expect(out.questions.map((q) => q.requirementId)).toEqual(["r1"]);
    expect(out.supportedKeywords).toEqual([{ term: "Cross-functional collaboration", evidenceIds: ["exp_harbor#r2"], reason: "Works with PMs." }]);
  });
});

describe("resume extras that miss a rule are corrected, not fatal", () => {
  const base = (summaryText: string) =>
    ({
      headline: "Senior Product Designer | UX Strategy", summary: { text: summaryText, evidenceIds: ["summary"] }, experiences: [],
      coreCompetencies: [], skills: ["Figma", "Design Systems 2000", "Miro"], inferredSkills: [], titleEquivalents: [], educationIds: [], certificationIds: [], projects: [], changeNotes: [], questions: [],
    }) satisfies OptimizedResume;

  it("falls back to the profile headline, drops unlisted technical skills and ties a years claim to the dates", () => {
    const total = Math.floor(experienceYears(TEST_PROFILE));
    const clean = sanitizeOptimized(TEST_PROFILE, base(`Designer with ${total}+ years of experience.`));
    expect(clean.headline).toBe(TEST_PROFILE.headline);
    expect(clean.skills).toEqual(["Figma", "Miro"]);
    expect(clean.summary.evidenceIds).toContain("experience_total");
    expect(clean.summary.text).toBe(`Designer with ${total}+ years of experience.`);
  });

  it("replaces a summary whose years the dates do not state with the candidate's own", () => {
    const clean = sanitizeOptimized(TEST_PROFILE, base("Designer with 40+ years of experience."));
    expect(clean.summary).toEqual({ text: TEST_PROFILE.summary!.trim(), evidenceIds: ["summary"] });
  });
});

