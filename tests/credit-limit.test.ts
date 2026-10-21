import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.AI_FORCE_MOCK = "true";

const { MemoryAppStore } = await import("@/server/store/memory");
const pipeline = await import("@/server/services/job-pipeline");
const { describeCreditStop } = await import("@/server/services/credit-stop");
const { InsufficientCreditsError } = await import("@/server/credits/types");
const { jobAnalyzer } = await import("@/server/ai");
const { TEST_JOB, seedTestUser } = await import("./fixtures");

type Store = InstanceType<typeof MemoryAppStore>;

/** Spends credits (15 at a time, then 3) until the balance is `target` or at most two above it. */
async function drainTo(store: Store, userId: string, target: number) {
  let n = 0;
  while ((await store.credits.balance(userId)) - 15 >= target) await store.credits.reserve(userId, "OPTIMIZE_RESUME", { idempotencyKey: `drain15:${n++}` });
  while ((await store.credits.balance(userId)) - 3 >= target) await store.credits.reserve(userId, "ATS_CHECK", { idempotencyKey: `drain3:${n++}` });
}

describe("running out of credits is a pause, not a loss", () => {
  let store: Store;
  let U = "";
  beforeEach(async () => {
    store = new MemoryAppStore();
    U = await seedTestUser(store);
    await pipeline.generateMasterDocuments(store, U, "seed");
  });

  it("stops before any paid step starts, spends nothing, and keeps the job", async () => {
    const job = await pipeline.createJob(store, U, TEST_JOB);
    await drainTo(store, U, 7);
    const before = await store.credits.balance(U);
    const err = await pipeline.analyzeJob(store, U, job.id, "r1").catch((e) => e);
    expect(err).toBeInstanceOf(InsufficientCreditsError);
    expect(err).toMatchObject({ required: 10, available: before });
    expect(await store.credits.balance(U)).toBe(before); // nothing was charged, not even for the first of the two steps
    expect(await store.getJob(U, job.id)).not.toBeNull();
    expect(await store.latestAnalysis(U, job.id)).toBeNull();

    const stop = await describeCreditStop(store, U, job.id, err);
    expect(stop).toMatchObject({ required: 10, available: before, saved: ["Your job description"], resumeHref: `/jobs/${job.id}` });
    expect(stop.saveFailed).toBeUndefined();
  });

  it("picks up from a saved analysis and only pays for the match", async () => {
    const job = await pipeline.createJob(store, U, TEST_JOB);
    await store.saveAnalysis(U, { jobId: job.id, result: jobAnalyzer.mock(job), promptVersion: "test", aiRunId: "test" });
    await drainTo(store, U, 5);
    const before = await store.credits.balance(U);
    expect(before).toBeLessThan(10); // not enough for both steps, enough for the one that is left
    await pipeline.analyzeJob(store, U, job.id, "r2");
    expect(await store.credits.balance(U)).toBe(before - 5);
    expect(await store.latestMatch(U, job.id)).not.toBeNull();
  });

  it("keeps a saved tailored resume and only pays for the cover letter that is left", async () => {
    const job = await pipeline.createJob(store, U, TEST_JOB);
    await pipeline.analyzeJob(store, U, job.id, "a");
    await pipeline.optimizeResume(store, U, job.id, "b"); // the first half of "Create application" finished
    const versions = (await store.resumeForJob(U, job.id))!.versions.length;
    expect(await pipeline.tailoredResumeIsCurrent(store, U, job.id)).toBe(true);

    await drainTo(store, U, 9);
    const short = await store.credits.balance(U);
    expect(short).toBeLessThan(10);
    const err = await pipeline.createApplication(store, U, job.id, "c").catch((e) => e);
    expect(err).toMatchObject({ required: 10, available: short }); // the cover letter only, not the resume again
    const stop = await describeCreditStop(store, U, job.id, err);
    expect(stop.saved).toEqual(["Your job description", "The job analysis", "Your Job Match Score", "Your tailored resume"]);

    // After buying credits the same task continues from the saved resume.
    await store.credits.grant(U, 100, "PURCHASE", "test-purchase", "Test purchase");
    const rich = await store.credits.balance(U);
    await pipeline.createApplication(store, U, job.id, "d");
    expect(await store.credits.balance(U)).toBe(rich - 10);
    expect((await store.resumeForJob(U, job.id))!.versions).toHaveLength(versions); // no second tailored resume
    expect(await store.coverLetterForJob(U, job.id)).not.toBeNull();
  });

  it("re-tailors the resume when answers were added after it was written", async () => {
    const job = await pipeline.createJob(store, U, TEST_JOB);
    await pipeline.analyzeJob(store, U, job.id, "a");
    await pipeline.optimizeResume(store, U, job.id, "b");
    await new Promise((r) => setTimeout(r, 5));
    await pipeline.checkMatch(store, U, job.id, "c"); // a newer match than the resume
    expect(await pipeline.tailoredResumeIsCurrent(store, U, job.id)).toBe(false);
  });

  it("never claims saved work it could not confirm", async () => {
    const job = await pipeline.createJob(store, U, TEST_JOB);
    const broken = Object.create(store) as Store;
    broken.getJob = async () => {
      throw new Error("database unreachable");
    };
    const stop = await describeCreditStop(broken, U, job.id, new InsufficientCreditsError(10, 3));
    expect(stop).toMatchObject({ saved: [], saveFailed: true, resumeHref: "/dashboard" });
    expect((await describeCreditStop(store, U, "job_missing", new InsufficientCreditsError(10, 3))).saveFailed).toBe(true);
  });

  it("has nothing to save outside a job", async () => {
    expect(await describeCreditStop(store, U, null, new InsufficientCreditsError(5, 2))).toEqual({ required: 5, available: 2, saved: [], resumeHref: "/dashboard" });
  });
});
