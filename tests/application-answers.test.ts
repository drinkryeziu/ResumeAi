import { describe, expect, it, vi } from "vitest";
import { ANSWER_FIELDS, ANSWER_KEYS, compactAnswers, givenAnswers, optionValues } from "@/server/domain/application-answers";
import { toProfileInput, toProfileSnapshot } from "@/server/domain/profile-mapping";
import { ProfileInputSchema } from "@/server/domain/profile-schema";
import { buildEvidence, evidenceBlock } from "@/server/ai/evidence";
import { masterResume, resumeOptimizer } from "@/server/ai/workflows/resume-optimizer";
import { candidateMatch } from "@/server/ai/workflows/candidate-match";
import { masterCoverLetter } from "@/server/ai/workflows/cover-letter";
import { resumeFromProfile } from "@/server/documents/model";
import { SETUP_STEPS } from "@/components/features/profile/profile-progress";
import { TEST_PROFILE } from "./fixtures";

vi.mock("server-only", () => ({}));

const input = () => structuredClone(toProfileInput(TEST_PROFILE, "alex@example.com", ""));

describe("application questions", () => {
  it("cover what application forms usually ask, each with a way to decline when it is personal", () => {
    expect(ANSWER_KEYS).toEqual(expect.arrayContaining(["authorizedToWork", "needsSponsorship", "relocate", "noticePeriod", "salaryExpectation", "gender", "race", "veteran", "disability"]));
    for (const k of ["gender", "race", "veteran", "disability"] as const) expect(optionValues(k)).toContain("decline");
    expect(ANSWER_FIELDS.needsSponsorship.label).toMatch(/visa sponsorship/i);
  });

  it("are an optional last step before the review, so nobody is blocked by them", () => {
    expect(SETUP_STEPS.map((s) => s.key)).toEqual(["details", "experience", "education", "application", "review"]);
  });

  it("are saved with the profile, and an empty set saves nothing", () => {
    const i = input();
    i.application = { ...i.application, authorizedToWork: "yes", gender: "self-describe", genderSelf: "Agender", salaryExpectation: " $95,000 " };
    const parsed = ProfileInputSchema.parse(i);
    const snap = toProfileSnapshot("prof_x", parsed, []);
    expect(snap.application).toEqual({ authorizedToWork: "yes", needsSponsorship: "no", gender: "self-describe", genderSelf: "Agender", salaryExpectation: "$95,000" });
    expect(toProfileInput(snap, "a@b.c", "").application?.genderSelf).toBe("Agender");
    const blank = input();
    blank.application = {};
    expect(toProfileSnapshot("p", ProfileInputSchema.parse(blank), []).application).toEqual({});
  });

  it("refuse an answer that is not one of the offered choices", () => {
    const i = input();
    i.application = { gender: "something else" };
    expect(ProfileInputSchema.safeParse(i).success).toBe(false);
  });

  it("are listed with their questions, a self-description replacing the gender choice", () => {
    const rows = givenAnswers({ gender: "self-describe", genderSelf: "Agender", race: "decline", relocate: "maybe", salaryExpectation: "  " });
    expect(rows.map((r) => [r.key, r.answer])).toEqual([["relocate", "Maybe, depending on the role"], ["gender", "Agender"], ["race", "Prefer not to say"]]);
    expect(compactAnswers({ gender: " ", race: "white" })).toEqual({ race: "white" });
  });
});

describe("application answers stay private", () => {
  const secret = { ...TEST_PROFILE, application: { gender: "non-binary", race: "asian", veteran: "protected-veteran", disability: "yes", salaryExpectation: "$777,123", authorizationNote: "Moon citizen" } };
  const needles = ["non-binary", "asian", "protected-veteran", "disability", "777,123", "Moon citizen", "Prefer not to say"];

  it("never enter the evidence the AI is allowed to use", () => {
    const text = evidenceBlock(buildEvidence(secret));
    for (const n of needles) expect(text).not.toContain(n);
  });

  it("never appear in any prompt sent to the AI", () => {
    const job = { title: "Designer", company: "Northwind", description: "x" };
    const analysis = { title: "Designer", seniority: "senior" as const, minYears: null, profession: null, industry: null, relatedIndustries: [], outcomes: [], summary: "", responsibilities: [], requirements: [], keywords: [] };
    const doc = resumeFromProfile(secret);
    const prompts = [
      masterResume.prompt({ profile: secret }),
      candidateMatch.prompt({ profile: secret, analysis }),
      resumeOptimizer.prompt({ profile: secret, job, analysis, match: { scores: { overall: 0, categories: { skills: null, experience: null, keywords: null, education: null, tools: null, industry: null } }, assessments: [], strong: [], partial: [], missing: [], missingKeywords: [], matchingKeywords: [], questions: [] } }),
      masterCoverLetter.prompt({ profile: secret, resume: doc, job: null, analysis: null, tone: "PROFESSIONAL", mode: "generate" }),
    ];
    for (const p of prompts) for (const n of needles) expect(`${p.system}\n${p.user}`).not.toContain(n);
  });

  it("never appear in a resume document", () => {
    const text = JSON.stringify(resumeFromProfile(secret));
    for (const n of needles) expect(text).not.toContain(n);
  });
});
