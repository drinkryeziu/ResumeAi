import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppStore } from "@/server/store/types";

/**
 * The behavior every AppStore must have, whatever it is built on. Run against the in-memory store always
 * and against MongoDB whenever MONGODB_TEST_URI is set (see store.memory.test.ts and store.mongo.test.ts).
 * Imports of app code happen inside the function so the callers can mock "server-only" first.
 */
export function storeContract(label: string, open: () => Promise<{ store: AppStore; close: () => Promise<void> }>) {
  describe(`AppStore contract: ${label}`, () => {
    let store: AppStore;
    let close: () => Promise<void>;
    let fixtures: typeof import("./fixtures");
    let pipeline: typeof import("@/server/services/job-pipeline");
    let accounts: typeof import("@/server/auth/accounts");

    const user = async (email: string, name = "Test User") => {
      const u = await accounts.onboardUser(store, { email, name, passwordHash: "hash" });
      await store.saveProfile(u.id, { ...structuredClone(fixtures.TEST_PROFILE), id: `prof_${u.id}`, approvedFacts: [] });
      return u;
    };

    beforeEach(async () => {
      fixtures = await import("./fixtures");
      pipeline = await import("@/server/services/job-pipeline");
      accounts = await import("@/server/auth/accounts");
      ({ store, close } = await open());
    });
    afterEach(async () => {
      await close();
    });

    it("creates users with a lower-cased unique email and finds them again", async () => {
      const a = await store.createUser({ email: "  Ada@Example.com ", name: " Ada ", passwordHash: null });
      expect(a).toMatchObject({ email: "ada@example.com", name: "Ada", passwordHash: null });
      expect((await store.findUserByEmail("ADA@example.com"))?.id).toBe(a.id);
      expect((await store.getUser(a.id))?.email).toBe("ada@example.com");
      await expect(store.createUser({ email: "ada@example.com", name: "Other", passwordHash: "x" })).rejects.toThrow(/already exists/i);
      expect(await store.getUser("usr_missing")).toBeNull();
      expect(await store.findUserByEmail("nobody@example.com")).toBeNull();
    });

    it("saves and reads a profile, and keeps approved answers when the profile is saved again", async () => {
      const u = await store.createUser({ email: "p@example.com", name: "P", passwordHash: null });
      expect(await store.findProfile(u.id)).toBeNull();
      await expect(store.getProfile(u.id)).rejects.toThrow(/not found/i);
      await expect(store.addApprovedFact(u.id, { topic: "x", question: "q", answer: "a", status: "APPROVED", jobId: "j" })).rejects.toThrow(/not found/i);

      const base = { ...structuredClone(fixtures.TEST_PROFILE), id: "prof_1", approvedFacts: [] };
      await store.saveProfile(u.id, base);
      expect(await store.getProfile(u.id)).toEqual(base);

      const fact = await store.addApprovedFact(u.id, { topic: "WCAG", question: "Do you?", answer: "I saved $5,000 a month on audits", status: "APPROVED", jobId: "job_1" });
      await store.saveProfile(u.id, { ...base, headline: "Changed", approvedFacts: [] });
      const after = await store.getProfile(u.id);
      expect(after.headline).toBe("Changed");
      expect(after.approvedFacts).toEqual([{ id: fact.id, topic: "WCAG", question: "Do you?", answer: "I saved $5,000 a month on audits", status: "APPROVED" }]);
    });

    it("corrects saved answers by id, keeps their topic, and leaves the others and other people's alone", async () => {
      const u = await user("facts-edit@example.com");
      const other = await user("facts-other@example.com");
      const base = (id: string) => ({ ...structuredClone(fixtures.TEST_PROFILE), id: `prof_${id}`, approvedFacts: [] });
      await store.saveProfile(u.id, base(u.id));
      await store.saveProfile(other.id, base(other.id));
      const a = await store.addApprovedFact(u.id, { topic: "WCAG", question: "Do you?", answer: "old", status: "APPROVED", jobId: "j1" });
      const b = await store.addApprovedFact(u.id, { topic: "Python", question: "Do you?", answer: null, status: "DECLINED", jobId: "j1" });
      const theirs = await store.addApprovedFact(other.id, { topic: "WCAG", question: "Do you?", answer: "theirs", status: "APPROVED", jobId: "j9" });

      await store.updateApprovedFacts(u.id, [
        { id: a.id, status: "APPROVED", answer: "I saved $5,000 a month" },
        { id: b.id, status: "APPROVED", answer: "Two years of scripting" },
        { id: theirs.id, status: "DECLINED", answer: null }, // somebody else's answer: not touched
        { id: "fact_missing", status: "DECLINED", answer: null }, // gone: skipped
      ]);
      const facts = (await store.getProfile(u.id)).approvedFacts;
      expect(facts.map((f) => [f.topic, f.question, f.status, f.answer]).sort()).toEqual([
        ["Python", "Do you?", "APPROVED", "Two years of scripting"],
        ["WCAG", "Do you?", "APPROVED", "I saved $5,000 a month"],
      ]);
      expect((await store.getProfile(other.id)).approvedFacts).toEqual([theirs]);

      await store.updateApprovedFacts(u.id, [{ id: a.id, status: "DECLINED", answer: null }]);
      expect((await store.getProfile(u.id)).approvedFacts.find((f) => f.id === a.id)).toMatchObject({ status: "DECLINED", answer: null });
      await expect(store.updateApprovedFacts("nobody", [])).rejects.toThrow(/not found/i);
    });

    it("remembers that the person applied for a job, lets them take it back, and only for their own jobs", async () => {
      const a = await user("applied-a@example.com");
      const b = await user("applied-b@example.com");
      const job = await store.createJob(a.id, { title: "Designer", company: "Northwind", description: "d" });
      const before = (await store.getJob(a.id, job.id))!;
      expect(before.appliedAt ?? null).toBeNull();

      const when = new Date("2026-10-22T10:00:00Z");
      expect(await store.setJobApplied(b.id, job.id, true, when)).toBe(false); // not theirs
      expect((await store.getJob(a.id, job.id))!.appliedAt ?? null).toBeNull();

      expect(await store.setJobApplied(a.id, job.id, true, when)).toBe(true);
      const applied = (await store.getJob(a.id, job.id))!;
      expect(new Date(applied.appliedAt!).toISOString()).toBe(when.toISOString());
      expect(+applied.updatedAt).toBe(+before.updatedAt); // ticking the box does not reorder the list

      expect(await store.setJobApplied(a.id, job.id, false)).toBe(true);
      expect((await store.getJob(a.id, job.id))!.appliedAt ?? null).toBeNull();
      expect(await store.setJobApplied(a.id, "job_missing", true)).toBe(false);
    });

    it("gives the operator view: people with their jobs, tailored documents and scores, and nobody else's mixed in", async () => {
      const a = await user("snap-a@example.com"); // has a profile
      const b = await store.createUser({ email: "snap-b@example.com", name: "No Profile", passwordHash: null }); // signed up, nothing else
      const job = await store.createJob(a.id, { title: "Designer", company: "Northwind", description: "d" });
      await store.createJob(b.id, { title: "Other", company: "Elsewhere", description: "d" });
      await store.setJobApplied(a.id, job.id, true);
      const snap = await store.adminSnapshot();
      expect(snap.users.map((u) => u.email)).toEqual(expect.arrayContaining(["snap-a@example.com", "snap-b@example.com"]));
      expect(snap.profileUserIds).toContain(a.id);
      expect(snap.profileUserIds).not.toContain(b.id);
      const mine = snap.jobs.find((j) => j.id === job.id)!;
      expect(mine.userId).toBe(a.id);
      expect(mine.appliedAt).not.toBeNull();
      expect(snap.jobs.filter((j) => j.userId === b.id)).toHaveLength(1);
      expect(snap.jobs.find((j) => j.userId === b.id)!.appliedAt ?? null).toBeNull();
    });

    it("counts security events and AI runs for the dashboard, and lets old ones fall out of the window", async () => {
      const now = new Date();
      const hourAgo = new Date(+now - 3_600_000);
      const dayAgo = new Date(+now - 2 * 86_400_000);
      const before = await store.securitySummary(dayAgo, 1000);
      await store.recordSecurityEvent({ type: "sign_in_failed", at: now });
      await store.recordSecurityEvent({ type: "sign_in_failed", at: hourAgo });
      await store.recordSecurityEvent({ type: "rate_limited", rule: "signin-ip", at: now });
      const sum = await store.securitySummary(new Date(+now - 86_400_000), 2);
      expect(sum.counts.sign_in_failed - before.counts.sign_in_failed).toBe(2);
      expect(sum.counts.rate_limited - before.counts.rate_limited).toBe(1);
      expect(sum.recent).toHaveLength(2); // limited to the newest two
      expect(sum.recent.every((e) => +e.at >= +hourAgo)).toBe(true);
      expect(JSON.stringify(sum.recent)).not.toMatch(/@|usr_/); // nothing personal is kept

      const u = await user("runs@example.com");
      const stats0 = await store.aiRunStats(new Date(+now - 60_000));
      const run = { userId: u.id, workflow: "w", provider: "mock", model: "m", promptVersion: "p", inputTokens: 1, outputTokens: 1, costUsd: 0, latencyMs: 1, error: null };
      await store.aiRuns.record({ ...run, status: "SUCCEEDED" });
      await store.aiRuns.record({ ...run, status: "FAILED" });
      const stats1 = await store.aiRunStats(new Date(+now - 60_000));
      expect(stats1.total - stats0.total).toBe(2);
      expect(stats1.failed - stats0.failed).toBe(1);
    });

    it("keeps the list of people who may open the admin dashboard, and drops a person when their account goes", async () => {
      const a = await user("viewer-a@example.com");
      const b = await user("viewer-b@example.com");
      expect(await store.isAdminUser(a.id)).toBe(false);
      await store.addAdminUser(a.id, "owner");
      await store.addAdminUser(a.id, "owner"); // twice: still once
      await store.addAdminUser(b.id, "owner");
      expect(await store.isAdminUser(a.id)).toBe(true);
      const list = await store.listAdmins();
      expect(list.filter((x) => x.userId === a.id)).toHaveLength(1);
      expect(list.find((x) => x.userId === a.id)).toMatchObject({ email: "viewer-a@example.com", name: expect.any(String) });
      expect(await store.removeAdminUser(b.id)).toBe(true);
      expect(await store.removeAdminUser(b.id)).toBe(false);
      expect(await store.isAdminUser(b.id)).toBe(false);
      await store.deleteAccount(a.id);
      expect(await store.isAdminUser(a.id)).toBe(false);
      expect((await store.listAdmins()).some((x) => x.userId === a.id)).toBe(false);
    });

    it("keeps an error log: newest first within a window, per person, clearable by problem, and gone with the account", async () => {
      const a = await user("err-a@example.com");
      const b = await user("err-b@example.com");
      const now = new Date();
      const old = new Date(+now - 5 * 86_400_000);
      const before = await store.errorSummary(new Date(+now - 86_400_000), 1000);
      await store.recordError({ at: old, source: "cv_upload", code: "scanned", message: "old one", userId: a.id });
      await store.recordError({ at: new Date(+now - 2000), source: "cv_upload", code: "scanned", message: "first", userId: a.id, path: "/onboarding" });
      await store.recordError({ at: new Date(+now - 1000), source: "analyze_job", code: "ai_busy", message: "second", userId: b.id });
      await store.recordError({ at: now, source: "page", code: "browser", message: "third", userId: null });

      const sum = await store.errorSummary(new Date(+now - 86_400_000), 2);
      expect(sum.total - before.total).toBe(3); // the five-day-old one is outside the window
      expect(sum.entries.map((x) => x.message)).toEqual(["third", "second"]); // newest first, limited
      expect(sum.entries[1]).toMatchObject({ source: "analyze_job", code: "ai_busy", userId: b.id });

      const mine = await store.listErrorsForUser(a.id);
      expect(mine.map((x) => x.message)).toEqual(["first", "old one"]);
      expect(mine[0]).toMatchObject({ path: "/onboarding" });

      expect(await store.clearErrors("cv_upload", "scanned")).toBeGreaterThanOrEqual(2);
      expect(await store.listErrorsForUser(a.id)).toEqual([]);
      expect((await store.errorSummary(new Date(+now - 86_400_000), 100)).entries.some((x) => x.code === "ai_busy")).toBe(true);

      await store.deleteAccount(b.id);
      expect(await store.listErrorsForUser(b.id)).toEqual([]);
      expect((await store.errorSummary(new Date(+now - 86_400_000), 100)).entries.some((x) => x.userId === b.id)).toBe(false);
    });

    it("keeps the numbers for the owner's money report: purchases, running costs, AI cost and credits used", async () => {
      const u = await user("money@example.com");
      const now = new Date();
      const old = new Date(+now - 45 * 86_400_000);
      const since = new Date(+now - 30 * 86_400_000);

      const p0 = await store.listPurchases(since);
      await store.recordPurchase({ at: old, kind: "PLAN", name: "Pro", cents: 1999, credits: 800 });
      await store.recordPurchase({ at: new Date(+now - 1000), kind: "PACK", name: "100 credits", cents: 499, credits: 100 });
      await store.recordPurchase({ at: now, kind: "PLAN", name: "Starter", cents: 999, credits: 300 });
      const buys = await store.listPurchases(since);
      expect(buys.length - p0.length).toBe(2); // the 45-day-old one is outside the window
      expect(buys.slice(0, 2).map((b) => b.name)).toEqual(["Starter", "100 credits"]); // newest first
      expect(JSON.stringify(buys)).not.toMatch(/userId|@/); // nothing about who bought

      const costs0 = await store.listRunningCosts();
      const host = await store.addRunningCost("Hosting", 2000);
      await store.addRunningCost("Database", 900);
      expect((await store.listRunningCosts()).map((c) => [c.label, c.cents]).slice(costs0.length)).toEqual([["Hosting", 2000], ["Database", 900]]);
      expect(await store.removeRunningCost(host.id)).toBe(true);
      expect(await store.removeRunningCost(host.id)).toBe(false);

      const ai0 = await store.aiCostSince(since);
      const run = { userId: u.id, workflow: "w", provider: "mock", model: "m", promptVersion: "p", inputTokens: 1, outputTokens: 1, latencyMs: 1, error: null };
      await store.aiRuns.record({ ...run, costUsd: 0.25, status: "SUCCEEDED" });
      await store.aiRuns.record({ ...run, costUsd: 0.5, status: "FAILED" });
      const ai1 = await store.aiCostSince(since);
      expect(ai1.runs - ai0.runs).toBe(2);
      expect(ai1.costUsd - ai0.costUsd).toBeCloseTo(0.75);

      const c0 = await store.creditTotalsSince(since);
      await store.credits.grant(u.id, 100, "GRANT", "money-grant");
      const r1 = await store.credits.reserve(u.id, "OPTIMIZE_RESUME", { idempotencyKey: "money-1" });
      await store.credits.reserve(u.id, "JOB_MATCH", { idempotencyKey: "money-2" });
      await store.credits.refund(r1, "failed");
      const c1 = await store.creditTotalsSince(since);
      expect(c1.consumed - c0.consumed).toBe(20); // 15 + 5
      expect(c1.refunded - c0.refunded).toBe(15);
    });

    it("keeps one answer per topic: a later answer replaces the earlier one", async () => {
      const u = await user("facts@example.com");
      await store.addApprovedFact(u.id, { topic: "WCAG", question: "q", answer: "first", status: "APPROVED", jobId: "j1" });
      await store.addApprovedFact(u.id, { topic: "Python", question: "q", answer: null, status: "DECLINED", jobId: "j1" });
      await store.addApprovedFact(u.id, { topic: "WCAG", question: "q", answer: "second", status: "APPROVED", jobId: "j2" });
      const facts = (await store.getProfile(u.id)).approvedFacts;
      expect(facts.map((f) => [f.topic, f.answer, f.status]).sort()).toEqual([
        ["Python", null, "DECLINED"],
        ["WCAG", "second", "APPROVED"],
      ]);
    });

    it("holds one pending CV import per user and can clear it", async () => {
      const u = await store.createUser({ email: "cv@example.com", name: "CV", passwordHash: null });
      expect(await store.getCvImport(u.id)).toBeNull();
      const draft = { firstName: "Ada" } as never;
      await store.setCvImport(u.id, { fileName: "cv.pdf", draft, createdAt: new Date("2026-01-02") });
      expect(await store.getCvImport(u.id)).toMatchObject({ fileName: "cv.pdf", draft: { firstName: "Ada" } });
      await store.setCvImport(u.id, { fileName: "new.pdf", draft, createdAt: new Date() });
      expect((await store.getCvImport(u.id))?.fileName).toBe("new.pdf");
      await store.setCvImport(u.id, null);
      expect(await store.getCvImport(u.id)).toBeNull();
    });

    it("creates, lists (newest first), updates and scopes jobs to their owner", async () => {
      const a = await user("a@example.com");
      const b = await user("b@example.com");
      const j1 = await store.createJob(a.id, { title: "First", company: "X", description: "d1" });
      await new Promise((r) => setTimeout(r, 5));
      const j2 = await store.createJob(a.id, { title: "Second", company: "Y", description: "d2" });
      expect((await store.listJobs(a.id)).map((j) => j.title)).toEqual(["Second", "First"]);
      expect(await store.getJob(a.id, j1.id)).toMatchObject({ title: "First", status: "DRAFT", userId: a.id });

      await new Promise((r) => setTimeout(r, 5));
      await store.setJobStatus(a.id, j1.id, "MATCHED");
      expect((await store.getJob(a.id, j1.id))?.status).toBe("MATCHED");
      expect((await store.listJobs(a.id))[0]?.id).toBe(j1.id); // updating moves it to the top

      // another account sees and changes nothing
      expect(await store.getJob(b.id, j1.id)).toBeNull();
      expect(await store.listJobs(b.id)).toEqual([]);
      await store.setJobStatus(b.id, j1.id, "READY");
      expect((await store.getJob(a.id, j1.id))?.status).toBe("MATCHED");
      expect(await store.deleteJob(b.id, j2.id)).toBe(false);
      expect(await store.getJob(a.id, j2.id)).not.toBeNull();
    });

    it("stores the latest analysis, match and ATS report per job and refuses other people's jobs", async () => {
      const a = await user("an@example.com");
      const b = await user("bn@example.com");
      const job = await store.createJob(a.id, { title: "T", company: "C", description: "d" });
      expect(await store.latestAnalysis(a.id, job.id)).toBeNull();

      await store.saveAnalysis(a.id, { jobId: job.id, result: { v: 1 } as never, promptVersion: "p1", aiRunId: "r1" });
      await new Promise((r) => setTimeout(r, 5));
      await store.saveAnalysis(a.id, { jobId: job.id, result: { v: 2 } as never, promptVersion: "p2", aiRunId: "r2" });
      expect((await store.latestAnalysis(a.id, job.id))?.promptVersion).toBe("p2");

      await store.saveMatch(a.id, { jobId: job.id, kind: "JOB_MATCH", overallScore: 40, result: {} as never, aiRunId: "r" });
      await new Promise((r) => setTimeout(r, 5));
      await store.saveMatch(a.id, { jobId: job.id, kind: "JOB_MATCH", overallScore: 77, result: {} as never, aiRunId: "r" });
      expect((await store.latestMatch(a.id, job.id))?.overallScore).toBe(77);

      await store.saveAts(a.id, { jobId: job.id, kind: "ATS", resumeVersionId: "rv", overallScore: 91, result: {} as never, aiRunId: "r" });
      expect((await store.latestAts(a.id, job.id))?.overallScore).toBe(91);

      await expect(store.saveAnalysis(b.id, { jobId: job.id, result: {} as never, promptVersion: "p", aiRunId: "r" })).rejects.toThrow(/not found/i);
      await expect(store.saveMatch(b.id, { jobId: job.id, kind: "JOB_MATCH", overallScore: 1, result: {} as never, aiRunId: "r" })).rejects.toThrow(/not found/i);
      expect(await store.latestAnalysis(b.id, job.id)).toBeNull();
      expect(await store.latestMatch(b.id, job.id)).toBeNull();
      expect(await store.latestAts(b.id, job.id)).toBeNull();
    });

    it("appends immutable resume versions, restores by copying forward, and keeps master and job documents apart", async () => {
      const u = await user("r@example.com");
      const doc = (summary: string) => ({ ...structuredClone(fixtures.TEST_PROFILE), summary }) as never;
      const v1 = await store.addResumeVersion(u.id, null, { label: "ORIGINAL", content: doc("one") as never, changeNotes: ["first"], name: "Master" });
      expect(v1.versions).toHaveLength(1);
      expect(v1).toMatchObject({ jobId: null, name: "Master", currentVersionId: v1.versions[0]!.id });
      const v2 = await store.addResumeVersion(u.id, null, { label: "USER_EDITED", content: doc("$5 saved") as never, changeNotes: [], name: "Master" });
      expect(v2.versions.map((v) => v.number)).toEqual([1, 2]);
      expect(v2.currentVersionId).toBe(v2.versions[1]!.id);
      expect((v2.versions[1]!.content as unknown as { summary: string }).summary).toBe("$5 saved"); // "$" text is stored as typed

      const restored = await store.restoreResumeVersion(u.id, v2.id, v2.versions[0]!.id);
      expect(restored.versions.map((v) => v.number)).toEqual([1, 2, 3]);
      expect(restored.versions[2]).toMatchObject({ label: "USER_EDITED", changeNotes: ["Restored from version 1"] });
      expect(restored.versions[0]).toEqual(v2.versions[0]); // history untouched
      await expect(store.restoreResumeVersion(u.id, v2.id, "rv_nope")).rejects.toThrow(/not found/i);

      const job = await store.createJob(u.id, { title: "T", company: "C", description: "d" });
      const jr = await store.addResumeVersion(u.id, job.id, { label: "ORIGINAL", content: doc("job") as never, changeNotes: [], name: "Job resume" });
      expect(jr.jobId).toBe(job.id);
      expect((await store.resumeForJob(u.id, null))?.id).toBe(v1.id);
      expect((await store.resumeForJob(u.id, job.id))?.id).toBe(jr.id);
      expect((await store.listResumes(u.id)).map((r) => r.jobId).sort()).toEqual([job.id, null].sort());
      expect(await store.resumeForJob("someone-else", null)).toBeNull();
    });

    it("gives every concurrent edit its own version number and never makes a second document", async () => {
      const u = await user("race@example.com");
      const doc = structuredClone(fixtures.TEST_PROFILE) as never;
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) => store.addResumeVersion(u.id, null, { label: "USER_EDITED", content: doc, changeNotes: [`edit ${i}`], name: "Master" })),
      );
      expect(new Set(results.map((r) => r.id)).size).toBe(1);
      const final = (await store.resumeForJob(u.id, null))!;
      expect(final.versions.map((v) => v.number).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(new Set(final.versions.map((v) => v.id)).size).toBe(10);
      expect(await store.listResumes(u.id)).toHaveLength(1);
    });

    it("stores cover letter versions with their tone", async () => {
      const u = await user("cl@example.com");
      await store.addCoverLetterVersion(u.id, null, { label: "AI_OPTIMIZED", content: { greeting: "Hi" } as never, tone: "PROFESSIONAL", name: "Master letter" });
      const c2 = await store.addCoverLetterVersion(u.id, null, { label: "USER_EDITED", content: { greeting: "Hello" } as never, tone: "WARM" as never, name: "Master letter" });
      expect(c2.versions.map((v) => [v.number, v.tone])).toEqual([
        [1, "PROFESSIONAL"],
        [2, "WARM"],
      ]);
      expect((await store.coverLetterForJob(u.id, null))?.currentVersionId).toBe(c2.versions[1]!.id);
      expect(await store.listCoverLetters(u.id)).toHaveLength(1);
      expect(await store.coverLetterForJob("someone-else", null)).toBeNull();
    });

    it("deletes a job together with everything made for it, and nothing else", async () => {
      const u = await user("del@example.com");
      const keep = await store.createJob(u.id, { title: "Keep", company: "K", description: "d" });
      const drop = await store.createJob(u.id, { title: "Drop", company: "D", description: "d" });
      for (const j of [keep, drop]) {
        await store.saveAnalysis(u.id, { jobId: j.id, result: {} as never, promptVersion: "p", aiRunId: "r" });
        await store.saveMatch(u.id, { jobId: j.id, kind: "JOB_MATCH", overallScore: 50, result: {} as never, aiRunId: "r" });
        await store.addResumeVersion(u.id, j.id, { label: "ORIGINAL", content: {} as never, changeNotes: [], name: "n" });
        await store.addCoverLetterVersion(u.id, j.id, { label: "ORIGINAL", content: {} as never, tone: "PROFESSIONAL", name: "n" });
      }
      await store.addResumeVersion(u.id, null, { label: "ORIGINAL", content: {} as never, changeNotes: [], name: "Master" });

      expect(await store.deleteJob(u.id, drop.id)).toBe(true);
      expect(await store.deleteJob(u.id, drop.id)).toBe(false);
      expect(await store.getJob(u.id, drop.id)).toBeNull();
      expect(await store.latestAnalysis(u.id, drop.id)).toBeNull();
      expect(await store.latestMatch(u.id, drop.id)).toBeNull();
      expect(await store.resumeForJob(u.id, drop.id)).toBeNull();
      expect(await store.coverLetterForJob(u.id, drop.id)).toBeNull();
      expect(await store.getJob(u.id, keep.id)).not.toBeNull();
      expect(await store.latestMatch(u.id, keep.id)).not.toBeNull();
      expect(await store.resumeForJob(u.id, keep.id)).not.toBeNull();
      expect(await store.resumeForJob(u.id, null)).not.toBeNull();
    });

    it("records AI runs per user", async () => {
      const a = await user("ra@example.com");
      const b = await user("rb@example.com");
      const run = {
        workflow: "JOB_MATCH",
        provider: "mock",
        model: "mock",
        promptVersion: "p",
        inputTokens: 1,
        outputTokens: 2,
        costUsd: 0.5,
        latencyMs: 10,
        status: "SUCCEEDED" as const,
        error: null,
      };
      const rec = await store.aiRuns.record({ userId: a.id, ...run });
      expect(rec.id).toBeTruthy();
      await store.aiRuns.record({ userId: a.id, ...run, workflow: "OPTIMIZE_RESUME" });
      await store.aiRuns.record({ userId: b.id, ...run });
      expect((await store.aiRuns.listForUser(a.id)).map((r) => r.workflow)).toEqual(["JOB_MATCH", "OPTIMIZE_RESUME"]);
      expect(await store.aiRuns.listForUser(b.id)).toHaveLength(1);
    });

    describe("credits", () => {
      it("grants starting credits at sign-up, once", async () => {
        const u = await accounts.onboardUser(store, { email: "c@example.com", name: "C", passwordHash: null });
        expect(await store.credits.balance(u.id)).toBe(60);
        await store.credits.grant(u.id, 60, "GRANT", `signup:${u.id}`); // same key again: no second grant
        expect(await store.credits.balance(u.id)).toBe(60);
        expect((await store.credits.history(u.id))[0]).toMatchObject({ delta: 60, balanceAfter: 60, reason: "GRANT" });
      });

      it("lists prices from data, and charges, refunds and settles like the ledger rules say", async () => {
        const u = await user("ledger@example.com");
        expect((await store.credits.listPrices()).map((p) => p.key)).toContain("OPTIMIZE_RESUME");
        const price = await store.credits.priceOf("OPTIMIZE_RESUME");
        expect(price).toBeGreaterThan(0);

        const r = await store.credits.reserve(u.id, "OPTIMIZE_RESUME", { idempotencyKey: "k1" });
        expect(await store.credits.balance(u.id)).toBe(60 - price);
        const again = await store.credits.reserve(u.id, "OPTIMIZE_RESUME", { idempotencyKey: "k1" }); // a double click
        expect(again.entry?.id).toBe(r.entry?.id);
        expect(await store.credits.balance(u.id)).toBe(60 - price);

        await store.credits.settle(r, { aiRunId: "run_1", documentId: "doc_1" });
        expect((await store.credits.history(u.id)).find((e) => e.id === r.entry!.id)).toMatchObject({ aiRunId: "run_1", documentId: "doc_1" });

        await store.credits.refund(r, "failed");
        await store.credits.refund(r, "failed again"); // refunded once only
        expect(await store.credits.balance(u.id)).toBe(60);
        const history = await store.credits.history(u.id);
        expect(history.map((e) => e.reason)).toEqual(["REFUND", "CONSUME", "GRANT"]); // newest first
        expect(history[0]).toMatchObject({ refundOfId: r.entry!.id, delta: price, balanceAfter: 60 });
        expect((await store.credits.history(u.id, 2)).length).toBe(2);
      });

      it("never lets a balance go negative", async () => {
        const u = await accounts.onboardUser(store, { email: "broke@example.com", name: "B", passwordHash: null });
        const price = await store.credits.priceOf("OPTIMIZE_RESUME");
        await store.credits.grant(u.id, price * 3 - 60, "ADJUST", "adj"); // exactly three actions' worth
        for (let i = 0; i < 3; i++) await store.credits.reserve(u.id, "OPTIMIZE_RESUME", { idempotencyKey: `s${i}` });
        expect(await store.credits.balance(u.id)).toBe(0);
        await expect(store.credits.reserve(u.id, "OPTIMIZE_RESUME", { idempotencyKey: "s3" })).rejects.toMatchObject({ name: "InsufficientCreditsError" });
        expect(await store.credits.balance(u.id)).toBe(0);
      });

      it("cannot be overspent by requests that arrive at the same time", async () => {
        const u = await accounts.onboardUser(store, { email: "rush@example.com", name: "R", passwordHash: null });
        const price = await store.credits.priceOf("OPTIMIZE_RESUME");
        await store.credits.grant(u.id, price * 4 - 60, "ADJUST", "adj2"); // enough for four
        const tries = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => store.credits.reserve(u.id, "OPTIMIZE_RESUME", { idempotencyKey: `rush${i}` })));
        expect(tries.filter((t) => t.status === "fulfilled")).toHaveLength(4);
        expect(tries.filter((t) => t.status === "rejected").every((t) => (t as PromiseRejectedResult).reason?.name === "InsufficientCreditsError")).toBe(true);
        expect(await store.credits.balance(u.id)).toBe(0);
        const consumed = (await store.credits.history(u.id, 100)).filter((e) => e.reason === "CONSUME");
        expect(consumed).toHaveLength(4);
      });

      it("charges once when the same request is sent many times at once", async () => {
        const u = await user("dupe@example.com");
        const price = await store.credits.priceOf("OPTIMIZE_RESUME");
        const all = await Promise.all(Array.from({ length: 6 }, () => store.credits.reserve(u.id, "OPTIMIZE_RESUME", { idempotencyKey: "same-click" })));
        expect(new Set(all.map((r) => r.entry?.id)).size).toBe(1);
        expect(await store.credits.balance(u.id)).toBe(60 - price);
      });
    });

    it("runs the whole application flow: master documents, analyze, create, delete", async () => {
      const u = await user("flow@example.com");
      await pipeline.generateMasterDocuments(store, u.id, "seed");
      const master = (await store.resumeForJob(u.id, null))!;
      expect(master.versions).toHaveLength(1);
      expect(await store.coverLetterForJob(u.id, null)).not.toBeNull();
      expect(await store.credits.balance(u.id)).toBe(60); // master documents are free

      const job = await pipeline.createJob(store, u.id, fixtures.TEST_JOB);
      await pipeline.analyzeJob(store, u.id, job.id, "analyze-1");
      expect((await store.latestMatch(u.id, job.id))!.overallScore).toBeGreaterThan(40);
      await pipeline.createApplication(store, u.id, job.id, "create-1");
      expect((await store.getJob(u.id, job.id))!.status).toBe("READY");
      expect((await store.resumeForJob(u.id, job.id))!.versions.map((v) => v.label)).toEqual(["ORIGINAL", "AI_OPTIMIZED"]);
      expect(await store.credits.balance(u.id)).toBe(60 - 35);
      expect(await store.resumeForJob(u.id, null)).toEqual(master); // the Master document never changed
      expect((await store.aiRuns.listForUser(u.id)).length).toBeGreaterThan(0);

      await pipeline.deleteApplication(store, u.id, job.id);
      expect(await store.getJob(u.id, job.id)).toBeNull();
      expect(await store.resumeForJob(u.id, null)).toEqual(master);
      expect(await store.credits.balance(u.id)).toBe(60 - 35); // no refund for credits already used
    });

    it("password reset links: valid once, expire, and a new one replaces the old", async () => {
      const u = await store.createUser({ email: "reset@example.com", name: "Reset", passwordHash: "old" });
      const now = new Date("2026-01-01T10:00:00Z");
      const hour = new Date(now.getTime() + 3_600_000);

      expect(await store.lastPasswordResetAt(u.id)).toBeNull();
      await store.createPasswordReset(u.id, "hash-1", now, hour);
      expect(await store.lastPasswordResetAt(u.id)).toEqual(now);
      expect(await store.findPasswordReset("hash-1", now)).toEqual({ userId: u.id });
      expect(await store.findPasswordReset("hash-1", now)).toEqual({ userId: u.id }); // looking doesn't use it up
      expect(await store.findPasswordReset("nope", now)).toBeNull();
      expect(await store.findPasswordReset("hash-1", new Date(hour.getTime() + 1))).toBeNull(); // expired

      // Two people clicking at once: only one gets in.
      const both = await Promise.all([store.consumePasswordReset("hash-1", now), store.consumePasswordReset("hash-1", now)]);
      expect(both.filter(Boolean)).toEqual([{ userId: u.id }]);
      expect(await store.consumePasswordReset("hash-1", now)).toBeNull();
      expect(await store.findPasswordReset("hash-1", now)).toBeNull();

      await store.createPasswordReset(u.id, "hash-2", now, hour);
      await store.createPasswordReset(u.id, "hash-3", now, hour);
      expect(await store.findPasswordReset("hash-2", now)).toBeNull(); // replaced
      expect(await store.findPasswordReset("hash-3", now)).toEqual({ userId: u.id });
      expect(await store.consumePasswordReset("hash-3", new Date(hour.getTime() + 1))).toBeNull();
    });

    it("sets a new password hash for an existing user only", async () => {
      const u = await store.createUser({ email: "pw@example.com", name: "Pw", passwordHash: "old" });
      expect(await store.setPasswordHash(u.id, "new")).toBe(true);
      expect((await store.getUser(u.id))!.passwordHash).toBe("new");
      expect(await store.setPasswordHash("usr_missing", "x")).toBe(false);
    });

    it("counts rate-limit hits per key and time window", async () => {
      const t = new Date("2026-05-01T10:00:00Z");
      expect(await store.hitRateLimit("k", 60_000, t)).toBe(1);
      expect(await store.hitRateLimit("k", 60_000, new Date(+t + 1000))).toBe(2);
      expect(await store.hitRateLimit("other", 60_000, t)).toBe(1); // another key has its own count
      expect(await store.hitRateLimit("k", 60_000, new Date(+t + 61_000))).toBe(1); // a new window starts again
      const counts = await Promise.all(Array.from({ length: 8 }, () => store.hitRateLimit("burst", 60_000, t)));
      expect([...counts].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // every simultaneous hit is counted once
    });

    it("deletes an account with everything in it, and nothing of anyone else's", async () => {
      const a = await user("gone@example.com");
      const b = await user("stays@example.com");
      const make = async (u: { id: string }, tag: string) => {
        await pipeline.generateMasterDocuments(store, u.id, `seed-${tag}`);
        const job = await pipeline.createJob(store, u.id, fixtures.TEST_JOB);
        await pipeline.analyzeJob(store, u.id, job.id, `an-${tag}`);
        await pipeline.createApplication(store, u.id, job.id, `app-${tag}`);
        await store.setCvImport(u.id, { fileName: "cv.pdf", draft: {} as never, createdAt: new Date() });
        await store.createPasswordReset(u.id, `hash-${tag}`, new Date(), new Date(Date.now() + 3_600_000));
        return job;
      };
      const jobA = await make(a, "a");
      const jobB = await make(b, "b");
      const balanceB = await store.credits.balance(b.id);

      await store.deleteAccount(a.id);

      expect(await store.getUser(a.id)).toBeNull();
      expect(await store.findUserByEmail("gone@example.com")).toBeNull();
      expect(await store.findProfile(a.id)).toBeNull();
      expect(await store.getCvImport(a.id)).toBeNull();
      expect(await store.listJobs(a.id)).toEqual([]);
      expect(await store.latestAnalysis(a.id, jobA.id)).toBeNull();
      expect(await store.latestMatch(a.id, jobA.id)).toBeNull();
      expect(await store.listResumes(a.id)).toEqual([]);
      expect(await store.listCoverLetters(a.id)).toEqual([]);
      expect(await store.credits.balance(a.id)).toBe(0);
      expect(await store.credits.history(a.id, 100)).toEqual([]);
      expect(await store.aiRuns.listForUser(a.id)).toEqual([]);
      expect(await store.findPasswordReset("hash-a", new Date())).toBeNull();

      // The other person is untouched.
      expect(await store.getUser(b.id)).not.toBeNull();
      expect(await store.findProfile(b.id)).not.toBeNull();
      expect(await store.getJob(b.id, jobB.id)).not.toBeNull();
      expect(await store.latestMatch(b.id, jobB.id)).not.toBeNull();
      expect((await store.listResumes(b.id)).length).toBeGreaterThan(0);
      expect(await store.credits.balance(b.id)).toBe(balanceB);
      expect((await store.aiRuns.listForUser(b.id)).length).toBeGreaterThan(0);
      expect(await store.findPasswordReset("hash-b", new Date())).not.toBeNull();

      await expect(store.deleteAccount(a.id)).resolves.toBeUndefined(); // doing it twice is harmless
      // The email can be used again for a brand-new account.
      await expect(store.createUser({ email: "gone@example.com", name: "New", passwordHash: null })).resolves.toBeTruthy();
    });

    it("deletes a profile with its Master documents, and keeps the account, credits, applications and other people", async () => {
      const a = await user("reset-a@example.com");
      const b = await user("reset-b@example.com");
      const make = async (u: { id: string }, tag: string) => {
        await pipeline.generateMasterDocuments(store, u.id, `seed-${tag}`);
        const job = await pipeline.createJob(store, u.id, fixtures.TEST_JOB);
        await pipeline.analyzeJob(store, u.id, job.id, `an-${tag}`);
        await pipeline.createApplication(store, u.id, job.id, `app-${tag}`);
        await store.setCvImport(u.id, { fileName: "cv.pdf", draft: {} as never, createdAt: new Date() });
        return job;
      };
      const jobA = await make(a, "a");
      await make(b, "b");
      const balanceA = await store.credits.balance(a.id);
      const resumesB = (await store.listResumes(b.id)).length;

      await store.deleteProfile(a.id);

      expect(await store.findProfile(a.id)).toBeNull();
      expect(await store.getCvImport(a.id)).toBeNull();
      expect(await store.resumeForJob(a.id, null)).toBeNull();
      expect(await store.coverLetterForJob(a.id, null)).toBeNull();
      // What is kept: the account, the credits, and the tailored application.
      expect(await store.getUser(a.id)).not.toBeNull();
      expect(await store.credits.balance(a.id)).toBe(balanceA);
      expect(await store.getJob(a.id, jobA.id)).not.toBeNull();
      expect(await store.resumeForJob(a.id, jobA.id)).not.toBeNull();
      expect(await store.coverLetterForJob(a.id, jobA.id)).not.toBeNull();
      // Someone else's profile and documents are untouched.
      expect(await store.findProfile(b.id)).not.toBeNull();
      expect((await store.listResumes(b.id)).length).toBe(resumesB);
      expect(await store.resumeForJob(b.id, null)).not.toBeNull();

      await expect(store.deleteProfile(a.id)).resolves.toBeUndefined(); // doing it twice is harmless
      // Starting over works: a new profile and new Master documents.
      await store.saveProfile(a.id, fixtures.TEST_PROFILE);
      await pipeline.generateMasterDocuments(store, a.id, "again-a");
      expect(await store.resumeForJob(a.id, null)).not.toBeNull();
      expect(await store.coverLetterForJob(a.id, null)).not.toBeNull();
    });

    it("deletes one resume or cover letter on its own, owner-scoped, and leaves the job and everything else", async () => {
      const a = await user("docs-a@example.com");
      const b = await user("docs-b@example.com");
      const make = async (u: { id: string }, tag: string) => {
        await pipeline.generateMasterDocuments(store, u.id, `seed-${tag}`);
        const job = await pipeline.createJob(store, u.id, fixtures.TEST_JOB);
        await pipeline.analyzeJob(store, u.id, job.id, `an-${tag}`);
        await pipeline.createApplication(store, u.id, job.id, `app-${tag}`);
        return job;
      };
      const jobA = await make(a, "a");
      await make(b, "b");
      const resumeA = (await store.resumeForJob(a.id, jobA.id))!;
      const letterA = (await store.coverLetterForJob(a.id, jobA.id))!;
      const masterA = (await store.resumeForJob(a.id, null))!;
      const resumeB = (await store.resumeForJob(b.id, null))!;

      expect(await store.deleteResume(b.id, resumeA.id)).toBe(false); // someone else's id does nothing
      expect(await store.deleteCoverLetter(b.id, letterA.id)).toBe(false);
      expect(await store.resumeForJob(a.id, jobA.id)).not.toBeNull();

      expect(await store.deleteCoverLetter(a.id, letterA.id)).toBe(true);
      expect(await store.coverLetterForJob(a.id, jobA.id)).toBeNull();
      expect(await store.resumeForJob(a.id, jobA.id)).not.toBeNull(); // the other document stays
      expect(await store.getJob(a.id, jobA.id)).not.toBeNull(); // and so does the job, with its analysis and match
      expect(await store.latestMatch(a.id, jobA.id)).not.toBeNull();

      expect(await store.deleteResume(a.id, masterA.id)).toBe(true);
      expect(await store.resumeForJob(a.id, null)).toBeNull();
      expect(await store.resumeForJob(a.id, jobA.id)).not.toBeNull(); // the application's resume is not the master
      expect(await store.deleteResume(a.id, masterA.id)).toBe(false); // twice is harmless
      expect((await store.resumeForJob(b.id, null))!.id).toBe(resumeB.id);
    });

    it("keeps the application answers with the profile, and lets them be cleared", async () => {
      const u = await user("answers@example.com");
      const profile = { ...structuredClone(fixtures.TEST_PROFILE), id: `prof_${u.id}`, approvedFacts: [] };
      await store.saveProfile(u.id, { ...profile, application: { authorizedToWork: "yes", gender: "decline" } });
      expect((await store.findProfile(u.id))!.application).toEqual({ authorizedToWork: "yes", gender: "decline" });
      await store.saveProfile(u.id, { ...profile, application: {} });
      expect((await store.findProfile(u.id))!.application ?? {}).toEqual({});
    });

    it("grants a promotion once per user, even when asked many times at once", async () => {
      const { grantPromotions, resetPromotionMemory } = await import("@/server/credits/promotions");
      resetPromotionMemory();
      const promo = { id: "contract-promo", credits: 150, active: true, label: "Launch credits" };
      const a = await user("promo-a@example.com");
      const b = await user("promo-b@example.com");
      const startA = await store.credits.balance(a.id);
      const startB = await store.credits.balance(b.id);
      await Promise.all(Array.from({ length: 6 }, () => grantPromotions(store.credits, a.id, [promo])));
      resetPromotionMemory(); // as if the server restarted
      await grantPromotions(store.credits, a.id, [promo]);
      expect(await store.credits.balance(a.id)).toBe(startA + 150);
      expect(await store.credits.balance(b.id)).toBe(startB); // nobody else is touched
      await grantPromotions(store.credits, b.id, [promo]);
      expect(await store.credits.balance(b.id)).toBe(startB + 150);
      expect((await store.credits.history(a.id, 20)).filter((e) => e.note === "Launch credits")).toHaveLength(1);
    });
  });
}
