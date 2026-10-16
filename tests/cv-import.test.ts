import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.AI_FORCE_MOCK = "true";

const { extractText } = await import("@/server/documents/extract-text");
const { exportResume } = await import("@/server/documents/export");
const { resumeFromProfile } = await import("@/server/documents/model");
const { DEMO_PROFILE } = await import("@/server/demo/fixtures");
const { resumeParser, runWorkflow } = await import("@/server/ai");
const { mergeDraftIntoInput, toProfileInput, toProfileSnapshot } = await import("@/server/domain/profile-mapping");
const { ProfileInputSchema } = await import("@/server/domain/profile-schema");
const { MemoryAppStore } = await import("@/server/store/memory");

async function parse(file: File) {
  const store = new MemoryAppStore();
  const text = await extractText(file);
  const { output } = await runWorkflow(resumeParser, { text }, { userId: "u", requestId: "r", credits: store.credits, runs: store.aiRuns });
  return output;
}

describe("Upload CV → pre-filled profile", () => {
  const cv = resumeFromProfile(DEMO_PROFILE);

  for (const format of ["pdf", "docx"] as const) {
    it(`reads a ${format.toUpperCase()} CV, passes the guard, and the form validates`, async () => {
      const draft = await parse(new File([new Uint8Array(await exportResume(cv, format))], `cv.${format}`));
      expect(draft).toMatchObject({ firstName: "Alex", lastName: "Rivera", headline: "Senior Product Designer", email: "alex.rivera@example.com" });
      expect(draft.experiences.map((e) => [e.title, e.company, e.startDate, e.endDate, e.isCurrent])).toEqual([
        ["Senior Product Designer", "Harbor Credit Union", "2021-03", null, true],
        ["Product Designer", "Lumen Analytics", "2018-01", "2021-02", false],
        ["UX/UI Designer", "Brightline Studio", "2016-06", "2017-12", false],
      ]);
      expect(draft.experiences[0]!.location).toBe("Charlotte, NC");
      expect(draft.experiences[0]!.bullets).toContain("Redesigned online account opening, raising completion from 41% to 63%");
      expect(draft.education[0]).toMatchObject({ school: "University of North Carolina at Charlotte", degree: "B.A.", field: "Graphic Design" });
      expect(draft.skills.map((s) => s.name)).toEqual(expect.arrayContaining(["Figma", "Design systems", "User research"]));
      expect(draft.certifications[0]).toMatchObject({ name: "UX Certification", issuer: "Nielsen Norman Group", issueDate: "2020-09" });
      expect(draft.languages.join(" ")).toMatch(/Spanish/);

      const { input, added } = mergeDraftIntoInput(toProfileInput(null, "", ""), draft);
      expect(added.experiences).toBe(3);
      expect(input.experiences[0]!.achievements).toContain("Redesigned online account opening, raising completion from 41% to 63%");
      const parsed = ProfileInputSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      expect(toProfileSnapshot("p", parsed.data!, []).experiences).toHaveLength(3);
    });
  }

  it("never overwrites what the user already wrote, and doesn't duplicate jobs", async () => {
    const draft = await parse(new File([new Uint8Array(await exportResume(cv, "pdf"))], "cv.pdf"));
    const base = toProfileInput({ ...DEMO_PROFILE, headline: "Design Lead", summary: "My own summary." }, "", "");
    const { input, added } = mergeDraftIntoInput(base, draft);
    expect(input.headline).toBe("Design Lead");
    expect(input.summary).toBe("My own summary.");
    expect(added.experiences).toBe(0);
    expect(input.experiences).toHaveLength(DEMO_PROFILE.experiences.length);
  });

  it("the guard rejects anything not written in the CV", async () => {
    const text = "Jamie Fox\nDesigner\njamie@example.com\nEXPERIENCE\nDesigner, Acme Mar 2020 – Present\nDid things";
    const v = resumeParser.check!({ text }, {
      firstName: "Jamie", lastName: "Fox", headline: null, email: null, phone: null, location: null, links: [], summary: null,
      experiences: [{ company: "Google", title: "Designer", location: null, startDate: null, endDate: null, isCurrent: true, bullets: [], tools: [], source: "Designer, Google 2019 – Present" }],
      education: [], skills: [{ name: "Kubernetes", category: "TECHNICAL" }], certifications: [], projects: [], languages: [],
    });
    expect(v.join(" ")).toMatch(/Google/);
    expect(v.join(" ")).toMatch(/Kubernetes/);
  });
});
