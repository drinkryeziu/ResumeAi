import { describe, expect, it } from "vitest";
import { buildEvidence } from "@/server/ai/evidence";
import { buildCareerAnalysis, experienceYears, groundAssessments, labelForYears, summarizeExperience, withoutYearsQuestions, yearsRequired, type ModelAssessment, type RoleTag } from "@/server/ai/experience";
import { overlongYears } from "@/server/ai/guard/fabrication-guard";
import type { JobAnalysis, Requirement } from "@/server/ai/workflows/job-analyzer";
import type { ProfileSnapshot } from "@/server/domain/profile";
import { TEST_PROFILE } from "./fixtures";

// Three finished design roles in three industries (no overlap):
//   A  Graphic Designer         FinTech     2010-01 → 2012-12  (3 years)
//   B  Senior Graphic Designer  Banking     2013-01 → 2016-12  (4 years)
//   C  Visual Designer          Healthcare  2017-01 → 2019-12  (3 years)
const role = (id: string, startDate: string, endDate: string) => ({ ...TEST_PROFILE.experiences[0]!, id, startDate, endDate, isCurrent: false });
const profile: ProfileSnapshot = { ...TEST_PROFILE, summary: "Designer.", experiences: [role("A", "2010-01", "2012-12"), role("B", "2013-01", "2016-12"), role("C", "2017-01", "2019-12")] };
const NOW = new Date("2026-01-01T00:00:00Z");

const tag = (experienceId: string, industry: string, industryFit: RoleTag["industryFit"], professionFit: RoleTag["professionFit"] = "same"): RoleTag => ({
  experienceId, profession: "Graphic design", industry, professionFit, industryFit, leadership: "none",
});
// Judged against a BANKING job: FinTech is closely related, healthcare is a different industry.
const tags = [tag("A", "FinTech", "related"), tag("B", "Banking", "direct"), tag("C", "Healthcare", "transferable")];

const req = (over: Partial<Requirement>): Requirement => ({ id: "r1", text: "x", category: "experience", importance: "required", keywords: [], measures: "none", years: null, subject: null, ...over });
const analysis = (...requirements: Requirement[]): JobAnalysis => ({
  title: "Graphic Designer", seniority: "senior", minYears: null, profession: "Graphic design", industry: "Banking", relatedIndustries: ["FinTech"], outcomes: [], summary: "", responsibilities: [], requirements, keywords: [],
});
const modelSays = (over: Partial<ModelAssessment> = {}): ModelAssessment => ({ requirementId: "r1", label: "none", evidenceIds: [], explanation: "No evidence.", qualifyingRoleIds: [], relatedRoleIds: [], yearsDeterminable: true, ...over });
const ground = (r: Requirement, m = modelSays()) => groundAssessments(profile, analysis(r), [m], tags, NOW)[0]!;

describe("years of experience come from the dates", () => {
  it("adds up every role, counting overlaps once and skipping gaps", () => {
    expect(experienceYears(profile)).toBe(10);
    const overlapping = { ...profile, experiences: [role("a", "2010-01", "2019-12"), role("b", "2015-01", "2018-01")] };
    expect(experienceYears(overlapping)).toBe(10);
  });

  it("reads the number a requirement asks for", () => {
    expect(yearsRequired("6+ years of experience in UX or product design")).toBe(6);
    expect(yearsRequired("3-5 years in a similar role")).toBe(3);
    expect(yearsRequired("Strong communication skills")).toBeNull();
  });

  it("gives the writers the computed total as citable evidence", () => {
    const item = buildEvidence(profile).find((e) => e.id === "experience_total");
    expect(item?.text).toContain("10 years");
    expect(item?.text).toContain("10+ years");
  });
});

describe("what a requirement measures decides how years are counted", () => {
  it("profession: all design roles count whatever the industry (3 + 4 + 3 = 10)", () => {
    const a = ground(req({ text: "5+ years in graphic design", measures: "profession", years: 5, subject: "graphic design" }));
    expect(a).toMatchObject({ label: "strong", qualifyingYears: 10, requiredYears: 5 });
  });

  it("industry: only the same industry counts directly; a related one is reported separately and never called direct", () => {
    const a = ground(req({ text: "5+ years in Banking", measures: "industry", years: 5, subject: "Banking" }));
    expect(a).toMatchObject({ qualifyingYears: 4, relatedYears: 3, label: "partial" }); // strictly: does not meet 5; with FinTech it would reach 7
    expect(a.explanation).toContain("4 years of direct experience");
    expect(a.explanation).toContain("3 years in related roles");
    expect(a.explanation).toMatch(/not on direct experience alone/);
  });

  it("profession + industry: the intersection, not the sum of the two totals", () => {
    const a = ground(req({ text: "5+ years of graphic design in Banking", measures: "profession_industry", years: 5, subject: "graphic design in banking" }));
    expect(a.qualifyingYears).toBe(4); // only role B is both; 10 design years + 4 banking years is never added
    expect(a.relatedYears).toBe(3); // FinTech design counts as related
    expect(a.label).toBe("partial");
  });

  it("skill: uses the roles the model says show it, and says so when the years cannot be known", () => {
    const known = ground(req({ text: "2+ years of UX research", measures: "skill", years: 2, subject: "UX research" }), modelSays({ label: "strong", evidenceIds: ["B"], qualifyingRoleIds: ["B"] }));
    expect(known).toMatchObject({ qualifyingYears: 4, label: "strong" });
    const unknown = ground(req({ text: "5+ years of UX research", measures: "skill", years: 5, subject: "UX research" }), modelSays({ label: "strong", evidenceIds: ["B"], qualifyingRoleIds: ["B"], yearsDeterminable: false }));
    expect(unknown).toMatchObject({ label: "unknown", status: "partial", explanation: "Skill demonstrated, but exact years cannot be reliably determined." });
  });

  it("leaves requirements that measure nothing to the model's own label", () => {
    const a = ground(req({ text: "Figma", category: "tool", measures: "none" }), modelSays({ label: "match", evidenceIds: ["A#t"], explanation: "Listed as a tool." }));
    expect(a).toMatchObject({ label: "match", status: "strong", explanation: "Listed as a tool." });
  });

  it("still grounds older analyses that only have a years phrase", () => {
    const old = req({ text: "6+ years of experience in design", measures: undefined as never, years: undefined as never });
    expect(ground(old, modelSays({ qualifyingRoleIds: [] })).qualifyingYears).toBe(10);
  });

  it("labels by how far direct and related experience reach the ask", () => {
    expect(labelForYears(5, 7, 7)).toBe("strong");
    expect(labelForYears(5, 5, 5)).toBe("match");
    expect(labelForYears(5, 4, 7)).toBe("partial");
    expect(labelForYears(5, 2, 2.5)).toBe("weak");
    expect(labelForYears(5, 0, 0)).toBe("none");
  });

  it("never asks about years", () => {
    const a = analysis(req({ id: "r1", text: "5+ years in design", measures: "profession", years: 5 }), req({ id: "r2", text: "Accessibility testing", category: "skill" }));
    const out = withoutYearsQuestions(a, [
      { requirementId: "r1", question: "Do you have 5+ years in design?" },
      { requirementId: "r2", question: "Have you run accessibility testing for 3 years?" },
      { requirementId: "r2", question: "Have you run accessibility testing on a product?" },
    ]);
    expect(out.map((q) => q.question)).toEqual(["Have you run accessibility testing on a product?"]);
  });
});

describe("experience summary and career analysis", () => {
  it("reports profession, industry and the intersection separately", () => {
    const s = summarizeExperience(profile, tags, [{ name: "Graphic / visual design", experienceIds: ["A", "B", "C"], reason: "Same work under three titles." }], NOW);
    expect(s).toMatchObject({ totalYears: 10, professionYears: 10, industryDirectYears: 4, industryRelatedYears: 7, professionInIndustryYears: 4 });
    expect(s.titleGroups[0]).toMatchObject({ years: 10 });
  });

  it("groups the whole career by profession and industry, keeping the same-looking facts apart", () => {
    const c = buildCareerAnalysis(
      profile,
      {
        primaryProfession: "Graphic design",
        seniority: "Senior",
        roles: [
          { experienceId: "A", profession: "Graphic design", industry: "FinTech", leadership: "none" },
          { experienceId: "B", profession: "graphic design", industry: "Banking", leadership: "people" },
          { experienceId: "C", profession: "Graphic design", industry: "Healthcare", leadership: "none" },
        ],
        titleGroups: [],
        progression: ["Moved from graphic designer to senior graphic designer.", "Ten years of experience."],
        strengths: ["Led a design system used by 400 teams."],
        differentiators: [],
        gaps: ["Add a result with a number for your role at Brightline."],
      },
      NOW,
    );
    expect(c.byProfession).toEqual([{ name: "Graphic design", years: 10 }]);
    expect(c.byIndustry.map((i) => [i.name, i.years])).toEqual([["Banking", 4], ["FinTech", 3], ["Healthcare", 3]]);
    expect(c.byProfessionInIndustry).toHaveLength(3);
    expect(c.leadershipYears).toBe(4);
    // Claims the dates or the evidence do not support are dropped, not repaired.
    expect(c.progression).toEqual(["Moved from graphic designer to senior graphic designer.", "Ten years of experience."]);
    expect(c.strengths).toEqual([]);
    expect(c.gaps).toHaveLength(1);
  });
});

describe("overlong years claims are rejected", () => {
  const evidence = buildEvidence(profile);
  const claim = (text: string, ids = ["experience_total"]) => overlongYears([{ text, evidenceIds: ids, where: "summary" }], evidence, profile);

  it("accepts what the dates support", () => {
    expect(claim("Designer with 10+ years of experience.")).toEqual([]);
    expect(claim("5 years leading design systems.")).toEqual([]);
  });

  it("rejects a longer span than the work history covers", () => {
    expect(claim("Designer with 15 years of experience.")).toHaveLength(1);
    expect(claim("11+ years in design.")).toHaveLength(1);
  });

  it("accepts a figure the cited evidence itself states", () => {
    const withClaim: ProfileSnapshot = { ...profile, summary: "Designer with 20 years of experience." };
    const ev = buildEvidence(withClaim);
    expect(overlongYears([{ text: "20 years of experience", evidenceIds: ["summary"], where: "summary" }], ev, withClaim)).toEqual([]);
  });
});
