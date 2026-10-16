import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.AI_FORCE_MOCK = "true";

const { MemoryAppStore } = await import("@/server/store/memory");
const pipeline = await import("@/server/services/job-pipeline");
const { DEMO_JOB, DEMO_PROFILE, DEMO_USER_ID: U } = await import("@/server/demo/fixtures");
const { exportPackage, exportResume, exportCoverLetter } = await import("@/server/documents/export");

describe("application flow (mock provider)", () => {
  let store: InstanceType<typeof MemoryAppStore>;
  beforeEach(async () => {
    store = new MemoryAppStore();
    await store.seedDemo();
    await pipeline.generateMasterDocuments(store, U, "seed");
  });

  it("creates the Master Resume and Master Cover Letter from the profile, for free", async () => {
    const resume = (await store.resumeForJob(U, null))!;
    const letter = (await store.coverLetterForJob(U, null))!;
    expect(resume.versions).toHaveLength(1);
    expect(resume.versions[0]!.content.experience.map((e) => e.company)).toEqual(["Harbor Credit Union", "Lumen Analytics", "Brightline Studio"]);
    expect(resume.versions[0]!.content.additional).toEqual([{ heading: "Languages", items: ["Spanish — Professional working proficiency"] }]);
    expect(letter.versions[0]!.content.greeting).toBe("Dear Hiring Manager,");
    expect(letter.versions[0]!.content.paragraphs.join(" ")).not.toMatch(/Northwind/);
    expect(await store.credits.balance(U)).toBe(1840);
  });

  it("Analyze Job → Create Application → download, leaving profile and Master documents unchanged", async () => {
    const profileBefore = await store.getProfile(U);
    const masterBefore = structuredClone(await store.resumeForJob(U, null));
    const job = await pipeline.createJob(store, U, DEMO_JOB);

    // Analyze Job = analysis + match in one action
    await pipeline.analyzeJob(store, U, job.id, "r1");
    const match = (await store.latestMatch(U, job.id))!;
    expect(match.overallScore).toBeGreaterThan(40);
    expect(match.result.matchingKeywords).toContain("figma");
    expect(match.result.missing.join(" ")).toMatch(/WCAG/i);
    expect(await store.credits.balance(U)).toBe(1840 - 10);

    // Create Application = tailored resume + tailored cover letter
    await pipeline.createApplication(store, U, job.id, "r2");
    const resume = (await store.resumeForJob(U, job.id))!;
    expect(resume.versions.map((v) => v.label)).toEqual(["ORIGINAL", "AI_OPTIMIZED"]);
    expect(resume.versions[0]!.content).toEqual(masterBefore!.versions[0]!.content); // V1 = copy of the Master Resume
    expect(resume.versions[1]!.content.experience[0]).toMatchObject({ company: "Harbor Credit Union", startDate: "2021-03", endDate: null });
    const letter = (await store.coverLetterForJob(U, job.id))!;
    expect(letter.versions[0]!.content.greeting).toBe("Dear Northwind Financial hiring team,");
    expect(await store.credits.balance(U)).toBe(1840 - 10 - 25);
    expect((await store.getJob(U, job.id))!.status).toBe("READY");

    expect(await store.getProfile(U)).toEqual(profileBefore);
    expect(await store.resumeForJob(U, null)).toEqual(masterBefore);

    const doc = resume.versions[1]!.content;
    expect((await exportResume(doc, "pdf")).subarray(0, 4).toString()).toBe("%PDF");
    expect((await exportResume(doc, "docx")).subarray(0, 2).toString()).toBe("PK");
    expect((await exportCoverLetter(letter.versions[0]!.content, "pdf")).subarray(0, 4).toString()).toBe("%PDF");
    expect((await exportPackage(doc, letter.versions[0]!.content, "Alex-Rivera")).subarray(0, 2).toString()).toBe("PK");
  });

  it("saves user edits as a new version and keeps facts from the profile", async () => {
    const job = await pipeline.createJob(store, U, DEMO_JOB);
    await pipeline.analyzeJob(store, U, job.id, "a");
    await pipeline.createApplication(store, U, job.id, "b");
    const before = (await store.resumeForJob(U, job.id))!;
    const versionsBefore = before.versions.length;
    const cur = before.versions.at(-1)!.content;
    await pipeline.saveResumeEdits(store, U, job.id, {
      headline: "Senior Product Designer",
      summary: "My own words.",
      experience: [{ sourceId: cur.experience[0]!.sourceId, bullets: ["Edited bullet"] }],
      skills: ["Figma"],
      projects: [],
    });
    const after = (await store.resumeForJob(U, job.id))!;
    const v = after.versions.at(-1)!;
    expect(v.label).toBe("USER_EDITED");
    expect(v.content.summary).toBe("My own words.");
    expect(v.content.experience[0]).toMatchObject({ company: "Harbor Credit Union", bullets: ["Edited bullet"] });
    expect(after.versions).toHaveLength(versionsBefore + 1);

    await pipeline.saveCoverLetterEdits(store, U, null, { greeting: "Hello,", paragraphs: ["One.", "Two."], closing: "Best," });
    expect((await store.coverLetterForJob(U, null))!.versions.at(-1)!.content.paragraphs).toEqual(["One.", "Two."]);
  });

  it("uses a Yes answer in the application with correct citations", async () => {
    const job = await pipeline.createJob(store, U, DEMO_JOB);
    await pipeline.analyzeJob(store, U, job.id, "a");
    const detail = "Ran WCAG 2.1 AA accessibility audits on the Harbor mobile app with our QA team.";
    await pipeline.answerGapQuestion(store, U, job.id, { topic: "Experience with accessibility and WCAG 2.1 AA standards", question: "?", answer: "yes", detail });
    await pipeline.createApplication(store, U, job.id, "c");
    expect((await store.resumeForJob(U, job.id))!.versions.at(-1)!.content.experience[0]!.bullets[0]).toBe(detail);
    expect((await store.coverLetterForJob(U, job.id))!.versions[0]!.content.paragraphs.join(" ")).toContain("WCAG 2.1 AA");
  });

  it("refunds credits when the guard rejects an output", async () => {
    const ai = await import("@/server/ai");
    const wf = { ...ai.jobAnalyzer, check: () => ["always wrong"] };
    const job = await pipeline.createJob(store, U, DEMO_JOB);
    await expect(ai.runWorkflow(wf, job, { userId: U, requestId: "g", credits: store.credits, runs: store.aiRuns })).rejects.toBeInstanceOf(ai.WorkflowOutputError);
    expect(await store.credits.balance(U)).toBe(1840);
  });

  it("refuses to create an application before analysis, and charges nothing", async () => {
    const job = await pipeline.createJob(store, U, DEMO_JOB);
    await expect(pipeline.createApplication(store, U, job.id, "x")).rejects.toThrow(/Analyze the job first/);
    expect(await store.credits.balance(U)).toBe(1840);
  });

  it("cannot read another user's job or documents", async () => {
    const job = await pipeline.createJob(store, U, DEMO_JOB);
    expect(await store.getJob("someone-else", job.id)).toBeNull();
    expect(await store.resumeForJob("someone-else", null)).toBeNull();
  });
});

describe("accounts and profiles", () => {
  it("new accounts get the Free plan's credits and must create a profile", async () => {
    const store = new MemoryAppStore();
    const { onboardUser } = await import("@/server/auth/accounts");
    const { hashPassword, verifyPassword } = await import("@/server/auth/password");
    const user = await onboardUser(store, { email: "New@Example.com", name: "Sam Lee", passwordHash: await hashPassword("correct horse") });
    expect(user.email).toBe("new@example.com");
    expect(await store.credits.balance(user.id)).toBe(60);
    expect(await store.findProfile(user.id)).toBeNull();
    expect(await verifyPassword("correct horse", user.passwordHash)).toBe(true);
    expect(await verifyPassword("wrong", user.passwordHash)).toBe(false);
    await expect(onboardUser(store, { email: "new@example.com", name: "x", passwordHash: null })).rejects.toThrow(/already exists/);
  });

  it("profile form round-trips through validation and mapping", async () => {
    const { toProfileInput, toProfileSnapshot } = await import("@/server/domain/profile-mapping");
    const { ProfileInputSchema } = await import("@/server/domain/profile-schema");
    const input = toProfileInput(DEMO_PROFILE, "", "");
    const parsed = ProfileInputSchema.parse(input);
    const snap = toProfileSnapshot(DEMO_PROFILE.id, parsed, []);
    expect(snap.experiences).toEqual(DEMO_PROFILE.experiences);
    expect(snap.skills.map((s) => s.name).sort()).toEqual(DEMO_PROFILE.skills.map((s) => s.name).sort());
    expect(snap.extras[0]).toMatchObject({ kind: "LANGUAGE", title: "Spanish" });
    // a job without an end date must be marked current
    const bad = { ...input, experiences: [{ ...input.experiences[1]!, endDate: "", isCurrent: false }] };
    expect(ProfileInputSchema.safeParse(bad).success).toBe(false);
  });
});

describe("job description upload", () => {
  it("reads text from PDF and Word files and rejects other types", async () => {
    const { extractText, UploadError } = await import("@/server/documents/extract-text");
    const { resumeFromProfile } = await import("@/server/documents/model");
    const doc = resumeFromProfile(DEMO_PROFILE);
    const pdf = new File([new Uint8Array(await exportResume(doc, "pdf"))], "job.pdf", { type: "application/pdf" });
    expect(await extractText(pdf)).toMatch(/Harbor Credit Union/);
    const docx = new File([new Uint8Array(await exportResume(doc, "docx"))], "job.docx");
    expect(await extractText(docx)).toMatch(/Lumen Analytics/);
    const txt = new File([DEMO_JOB.description], "job.txt", { type: "text/plain" });
    expect(await extractText(txt)).toMatch(/Senior UX Designer/);
    await expect(extractText(new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "photo.jpg"))).rejects.toBeInstanceOf(UploadError);
  });
});
