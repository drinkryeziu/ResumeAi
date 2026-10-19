import { describe, expect, it } from "vitest";
import { buildEvidence } from "@/server/ai/evidence";
import { inventedNumbers, unknownOrganizations, unsupportedSkills } from "@/server/ai/guard/fabrication-guard";
import { checkOptimizedResume, type OptimizedResume } from "@/server/ai/workflows/resume-optimizer";
import { TEST_PROFILE } from "./fixtures";

const evidence = buildEvidence(TEST_PROFILE);

const valid = (): OptimizedResume => ({
  headline: "Senior Product Designer",
  summary: { text: "Product designer with 8 years of experience in financial services.", evidenceIds: ["summary"] },
  experiences: [
    {
      experienceId: "exp_harbor",
      bullets: [{ text: "Raised online account opening completion from 41% to 63% through a redesign", evidenceIds: ["exp_harbor#a0"] }],
    },
  ],
  skills: ["Figma", "Design systems", "Usability testing"],
  educationIds: ["edu_unc"],
  certificationIds: ["cert_nng"],
  projects: [],
  changeNotes: [],
  questions: [],
});

describe("fabrication guard", () => {
  it("accepts output grounded in the profile", () => {
    expect(checkOptimizedResume(TEST_PROFILE, valid())).toEqual([]);
  });

  it("rejects a metric that is not in the cited evidence", () => {
    const out = valid();
    out.experiences[0]!.bullets[0]!.text = "Raised completion by 85% through a redesign";
    expect(checkOptimizedResume(TEST_PROFILE, out).join(" ")).toMatch(/85%/);
  });

  it("rejects a skill the candidate never listed", () => {
    expect(unsupportedSkills(["Figma", "Kubernetes"], TEST_PROFILE)).toHaveLength(1);
  });

  it("rejects an unknown evidence id and an unknown role", () => {
    const out = valid();
    out.experiences.push({ experienceId: "exp_google", bullets: [{ text: "Led design at scale", evidenceIds: ["exp_google#a0"] }] });
    const v = checkOptimizedResume(TEST_PROFILE, out).join(" ");
    expect(v).toMatch(/exp_google/);
  });

  it("rejects borrowing an achievement from a different role", () => {
    const out = valid();
    out.experiences[0]!.bullets.push({ text: "Launched a self-serve report builder adopted by 1,200 customer accounts", evidenceIds: ["exp_lumen#a0"] });
    expect(checkOptimizedResume(TEST_PROFILE, out).join(" ")).toMatch(/another role/);
  });

  it("rejects a headline the candidate has never held", () => {
    const out = valid();
    out.headline = "Head of Design";
    expect(checkOptimizedResume(TEST_PROFILE, out).join(" ")).toMatch(/headline/);
  });

  it("allows an approved gap answer to be used", () => {
    const profile = { ...TEST_PROFILE, approvedFacts: [{ id: "fact_1", topic: "Accessibility testing", question: "?", answer: "Ran WCAG 2.1 AA audits on the Harbor app", status: "APPROVED" as const }] };
    const out = valid();
    out.skills.push("Accessibility testing");
    out.experiences[0]!.bullets.push({ text: "Ran WCAG 2.1 AA accessibility audits on the mobile app", evidenceIds: ["fact_1"] });
    expect(checkOptimizedResume(profile, out)).toEqual([]);
  });

  it("does not treat years as invented numbers", () => {
    expect(inventedNumbers([{ text: "Since 2021 I have led design", evidenceIds: ["exp_harbor"], where: "x" }], evidence)).toEqual([]);
  });

  it("flags organizations not in the profile", () => {
    expect(unknownOrganizations(["Harbor Credit Union", "Goldman Sachs"], TEST_PROFILE)).toHaveLength(1);
  });
});
