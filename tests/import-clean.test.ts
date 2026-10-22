import { describe, expect, it } from "vitest";
import { profileProgress, friendlyMessage } from "@/components/features/profile/profile-progress";
import { cleanLines, cleanMonth, clip } from "@/server/domain/import-clean";
import { mergeDraftIntoInput, toProfileInput } from "@/server/domain/profile-mapping";
import type { ProfileDraft } from "@/server/ai/workflows/resume-parser";

const base = toProfileInput(null, "x@example.com", "Ana Active");
const long = (n: number) => `Led the redesign of the customer portal and its design system across four teams, ${"measured by usability tests. ".repeat(n)}`.trim();

// What a real CV reader can hand back: everything that breaks a rule of the profile form, at once.
const messy: ProfileDraft = {
  firstName: "Ana",
  lastName: "Active",
  headline: "Senior Product Designer",
  email: "ana@example.com",
  phone: "+1 555 123 4567 / +1 555 987 6543 / +1 555 000 1111 / office extension 4",
  location: "Charlotte, NC, USA",
  links: [
    { label: "LinkedIn", url: "linkedin.com/in/ana-active)" },
    { label: "GitHub", url: "not a link at all" },
  ],
  summary: "A".repeat(2600),
  experiences: [
    { company: "Acme Bank", title: "Senior Designer", location: null, startDate: "March 2019", endDate: "2024-06-15", isCurrent: false, bullets: [long(30), "Built the design system, 20% faster"], tools: ["Figma"], source: "Senior Designer, Acme Bank" },
    { company: "Old Co", title: "Designer", location: null, startDate: "2015-01", endDate: "03/2018", isCurrent: false, bullets: [], tools: [], source: "Designer, Old Co" },
  ],
  education: [{ school: "University of Berlin", degree: "BA", field: "Design", endDate: "2010", source: "BA Design, University of Berlin" }],
  skills: Array.from({ length: 45 }, (_, i) => ({ name: `Skill ${i + 1}`, category: "TECHNICAL" as const })),
  certifications: [{ name: "WCAG Specialist", issuer: null, issueDate: "2021", source: "WCAG Specialist" }],
  projects: [],
  languages: ["Spanish"],
};

describe("making an imported CV fit the form", () => {
  it("leaves nothing that breaks a rule of the form, so the steps are never stuck", () => {
    const { input } = mergeDraftIntoInput(base, messy);
    expect(profileProgress(input).issues).toEqual([]);
  });

  it("turns the dates a CV really has into months, and leaves out the ones that are only a year", () => {
    expect(cleanMonth("March 2019")).toBe("2019-03");
    expect(cleanMonth("Mar. 2019")).toBe("2019-03");
    expect(cleanMonth("2024-06-15")).toBe("2024-06");
    expect(cleanMonth("3/2018")).toBe("2018-03");
    expect(cleanMonth("2021-3")).toBe("2021-03");
    expect(cleanMonth("2010")).toBe("");
    expect(cleanMonth("2019-13")).toBe("");
    expect(cleanMonth("Present")).toBe("");
    expect(cleanMonth(null)).toBe("");
  });

  it("keeps what is already fine exactly as it is", () => {
    const { input } = mergeDraftIntoInput(base, messy);
    const exp = input.experiences.find((e) => e.company === "Old Co")!;
    expect(exp).toMatchObject({ startDate: "2015-01", endDate: "2018-03", title: "Designer" });
    expect(input.firstName).toBe("Ana");
    expect(input.skills.TECHNICAL.slice(0, 3)).toEqual(["Skill 1", "Skill 2", "Skill 3"]);
    expect(input.extras.LANGUAGE).toEqual(["Spanish"]);
  });

  it("splits a very long bullet at sentence ends instead of losing it, and caps lists", () => {
    const parts = cleanLines([long(30)]);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 400)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toContain("Led the redesign of the customer portal");
    expect(cleanLines(Array.from({ length: 80 }, (_, i) => `s${i}`))).toHaveLength(30);
    expect(clip("short", 10)).toBe("short");
    expect(clip("One sentence here. Another sentence follows it.", 30)).toBe("One sentence here.");
  });

  it("drops a phone number that is too long to be one and links that aren't addresses, and fixes a link it can", () => {
    const { input } = mergeDraftIntoInput(base, messy);
    expect(input.phone).toBe("");
    expect(input.links.github).toBe("");
    expect(input.summary!.length).toBeLessThanOrEqual(2000);
  });

  it("still tells the person which jobs need their start month, counting the ones that were only a year", () => {
    const draft = { ...messy, experiences: [{ ...messy.experiences[0]!, startDate: "2019" }, messy.experiences[1]!] };
    const { input, added } = mergeDraftIntoInput(base, draft);
    expect(added.missingStart).toEqual(["Senior Designer at Acme Bank"]);
    expect(profileProgress(input).issues.map((i) => i.field)).toEqual(["experiences.0.startDate"]);
  });
});

describe("saying what is wrong in plain words", () => {
  it("rewrites the form rules' own wording", () => {
    expect(friendlyMessage("Too big: expected string to have <=400 characters")).toBe("Too long: keep this to 400 characters or fewer.");
    expect(friendlyMessage("Too big: expected array to have <=30 items")).toBe("Too many entries: keep it to 30 or fewer.");
    expect(friendlyMessage("Invalid string: must match pattern /^\\d{4}-\\d{2}$/")).toBe("Use a month and year, like Mar 2021.");
    expect(friendlyMessage("Each job needs a company.")).toBe("Each job needs a company.");
  });
});
