import { describe, expect, it } from "vitest";
import { DEMO_PROFILE } from "@/server/demo/fixtures";
import { toProfileInput } from "@/server/domain/profile-mapping";
import { ProfileInputSchema, type ProfileInput } from "@/server/domain/profile-schema";
import { issuesForStep, profileProgress, SECTIONS, SETUP_STEPS } from "@/components/features/profile/profile-progress";

const complete = (): ProfileInput => structuredClone(toProfileInput(DEMO_PROFILE, "alex.rivera@example.com", ""));

describe("profile editor progress", () => {
  it("reports a complete profile as ready to save", () => {
    const p = profileProgress(complete());
    expect(p.issues).toEqual([]);
    expect(p.completeCount).toBe(SECTIONS.length);
    expect(Object.values(p.sections).every((s) => s.status === "complete")).toBe(true);
  });

  it("flags missing required fields in the section they belong to, keyed by field", () => {
    const input = complete();
    input.firstName = "";
    input.experiences[0]!.company = "";
    input.experiences[0]!.startDate = "";
    const p = profileProgress(input);
    expect(p.sections.personal.status).toBe("attention");
    expect(p.sections.experience.status).toBe("attention");
    expect(p.sections.skills.status).toBe("complete");
    expect(p.errors.get("firstName")).toBe("Add your first name.");
    expect(p.errors.get("experiences.0.company")).toBeTruthy();
    expect(p.errors.get("experiences.0.startDate")).toBeTruthy();
  });

  it("puts the 'end month or current job' rule on the end-month field", () => {
    const input = complete();
    input.experiences[0]!.isCurrent = false;
    input.experiences[0]!.endDate = "";
    expect(profileProgress(input).errors.has("experiences.0.endDate")).toBe(true);
  });

  it("treats empty optional sections as not added, not as errors", () => {
    const input = complete();
    input.certifications = [];
    input.projects = [];
    const p = profileProgress(input);
    expect(p.issues).toEqual([]);
    expect(p.sections.certifications.status).toBe("empty");
    expect(p.sections.projects.status).toBe("empty");
    expect(p.completeCount).toBe(SECTIONS.length - 2);
  });

  it("needs attention when a started optional entry is missing its required name", () => {
    const input = complete();
    input.education = [...input.education, { id: "edu_blank", school: "", degree: "", field: "", startDate: "", endDate: "", description: "" }];
    const p = profileProgress(input);
    expect(p.sections.education.status).toBe("attention");
    expect(p.errors.get(`education.${input.education.length - 1}.school`)).toBeTruthy();
  });

  it("asks for at least one job, matching the server action", () => {
    const input = complete();
    input.experiences = [];
    const p = profileProgress(input);
    expect(p.sections.experience.status).toBe("attention");
    expect(p.errors.has("experiences")).toBe(true);
  });

  it("never says a profile is fine when the server schema would reject it", () => {
    const input = complete();
    input.email = "not-an-email";
    input.links.linkedin = "linkedin.com/in/alex";
    expect(ProfileInputSchema.safeParse(input).success).toBe(false);
    const p = profileProgress(input);
    expect(p.issues.length).toBeGreaterThan(0);
    expect(p.errors.get("email")).toBeTruthy();
    expect(p.errors.get("links.linkedin")).toMatch(/https:\/\//);
  });
});

describe("first-time setup steps", () => {
  it("puts every editor section on exactly one step, with review last and empty", () => {
    const all = SETUP_STEPS.flatMap((s) => [...s.sections]);
    expect(all.sort()).toEqual(SECTIONS.map(([id]) => id).sort());
    expect(new Set(all).size).toBe(all.length);
    expect(SETUP_STEPS.at(-1)?.key).toBe("review");
    expect(SETUP_STEPS.at(-1)?.sections).toHaveLength(0);
  });

  it("blocks a step only for its own required items", () => {
    const input = complete();
    input.firstName = "";
    input.experiences[0]!.company = "";
    const p = profileProgress(input);
    expect(issuesForStep(p, 0).map((i) => i.field)).toEqual(["firstName"]);
    expect(issuesForStep(p, 1).map((i) => i.field)).toEqual(["experiences.0.company"]);
    expect(issuesForStep(p, 2)).toEqual([]);
    expect(issuesForStep(p, 3)).toEqual([]);
  });

  it("lets a brand-new blank profile through no step until the basics are filled in", () => {
    const blank = toProfileInput(null, "", "");
    blank.experiences = [{ id: "exp_x", company: "", title: "", location: "", startDate: "", endDate: "", isCurrent: false, responsibilities: [], achievements: [], tools: [] }];
    const p = profileProgress(blank);
    expect(issuesForStep(p, 0).length).toBeGreaterThan(0);
    expect(issuesForStep(p, 1).length).toBeGreaterThan(0);
    expect(issuesForStep(p, 2)).toEqual([]);
  });
});
