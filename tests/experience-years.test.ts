import { describe, expect, it } from "vitest";
import { buildEvidence } from "@/server/ai/evidence";
import { experienceYears, groundYearsRequirements, yearsRequired } from "@/server/ai/experience";
import { overlongYears } from "@/server/ai/guard/fabrication-guard";
import { buildMatchReport, type MatchModelOutput } from "@/server/ai/workflows/candidate-match";
import type { JobAnalysis } from "@/server/ai/workflows/job-analyzer";
import type { ProfileSnapshot } from "@/server/domain/profile";
import { TEST_PROFILE } from "./fixtures";

// Two finished roles: Jan 2010 – Dec 2015 and Jun 2016 – Jun 2024 = 167 months = 13.9 years (the gap is not counted).
const role = (id: string, startDate: string, endDate: string) => ({ ...TEST_PROFILE.experiences[0]!, id, startDate, endDate, isCurrent: false });
const profile: ProfileSnapshot = { ...TEST_PROFILE, summary: "Designer.", experiences: [role("exp_a", "2010-01", "2015-12"), role("exp_b", "2016-06", "2024-06")] };

const analysis = (text: string, category: "experience" | "skill" = "experience"): JobAnalysis => ({
  title: "Designer",
  seniority: "senior",
  minYears: yearsRequired(text),
  summary: "",
  responsibilities: [],
  requirements: [{ id: "r1", text, category, importance: "required", keywords: [] }],
  keywords: [],
});

const modelSaysMissing = (q: string): MatchModelOutput => ({
  assessments: [{ requirementId: "r1", status: "missing", evidenceIds: [], explanation: "No evidence." }],
  questions: [{ requirementId: "r1", question: q }],
});

describe("years of experience come from the dates", () => {
  it("adds up every role, counting overlaps once and skipping gaps", () => {
    expect(experienceYears(profile)).toBe(13.9);
    expect(experienceYears({ ...profile, experiences: [role("a", "2010-01", "2020-01"), role("b", "2015-01", "2018-01")] })).toBe(10);
  });

  it("reads the number a requirement asks for", () => {
    expect(yearsRequired("6+ years of experience in UX or product design")).toBe(6);
    expect(yearsRequired("3-5 years in a similar role")).toBe(3);
    expect(yearsRequired("Strong communication skills")).toBeNull();
  });

  it("meets a years requirement from the work history and never asks about it", () => {
    const a = analysis("5+ years of experience in product design");
    const out = groundYearsRequirements(profile, a, modelSaysMissing("Do you have 5+ years of experience in product design?"));
    expect(out.assessments[0]).toMatchObject({ status: "strong", evidenceIds: ["exp_a", "exp_b"] });
    expect(out.assessments[0]!.explanation).toContain("13+");
    expect(out.questions).toEqual([]);
  });

  it("does not ask either when the history is too short", () => {
    const a = analysis("20 years of experience leading design teams");
    const out = groundYearsRequirements(profile, a, modelSaysMissing("Do you have 20 years of leadership experience?"));
    expect(out.assessments[0]!.status).toBe("missing");
    expect(out.questions).toEqual([]);
  });

  it("still asks other questions", () => {
    const a = analysis("Experience with accessibility testing", "skill");
    const m = modelSaysMissing("Have you run accessibility testing on a product?");
    expect(groundYearsRequirements(profile, a, m)).toEqual(m);
  });

  it("reaches the stored match report", () => {
    const report = buildMatchReport({ profile, analysis: analysis("6+ years of experience in UX") }, modelSaysMissing("Do you have 6+ years of UX experience?"));
    expect(report.questions).toEqual([]);
    expect(report.strong).toEqual(["6+ years of experience in UX"]);
  });

  it("gives the writers the computed total as citable evidence", () => {
    const item = buildEvidence(profile).find((e) => e.id === "experience_total");
    expect(item?.text).toContain("13 years");
    expect(item?.text).toContain("13+ years");
  });
});

describe("overlong years claims are rejected", () => {
  const evidence = buildEvidence(profile);
  const claim = (text: string, ids = ["experience_total"]) => overlongYears([{ text, evidenceIds: ids, where: "summary" }], evidence, profile);

  it("accepts what the dates support", () => {
    expect(claim("Designer with 13+ years of experience.")).toEqual([]);
    expect(claim("Over 10 years of experience.")).toEqual([]);
    expect(claim("5 years leading design systems.")).toEqual([]);
  });

  it("rejects a longer span than the work history covers", () => {
    expect(claim("Designer with 15 years of experience.")).toHaveLength(1);
    expect(claim("14+ years in design.")).toHaveLength(1);
  });

  it("accepts a figure the cited evidence itself states", () => {
    const withClaim: ProfileSnapshot = { ...profile, summary: "Designer with 20 years of experience." };
    const ev = buildEvidence(withClaim);
    expect(overlongYears([{ text: "20 years of experience", evidenceIds: ["summary"], where: "summary" }], ev, withClaim)).toEqual([]);
  });
});
