import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.AI_FORCE_MOCK = "true";

const { MemoryAppStore } = await import("@/server/store/memory");
const pipeline = await import("@/server/services/job-pipeline");
const { deleteAccount, exportAccountData } = await import("@/server/services/account");
const { seedTestUser, TEST_JOB } = await import("./fixtures");

async function withData() {
  const store = new MemoryAppStore();
  const id = await seedTestUser(store);
  await pipeline.generateMasterDocuments(store, id, "seed");
  const job = await pipeline.createJob(store, id, TEST_JOB);
  await pipeline.analyzeJob(store, id, job.id, "a");
  await pipeline.createApplication(store, id, job.id, "b");
  return { store, id, job };
}

describe("download my data", () => {
  it("contains everything held about the person, and never the password hash", async () => {
    const { store, id, job } = await withData();
    await store.setPasswordHash(id, "scrypt$secret-hash-value");
    const data = (await exportAccountData(store, id))!;
    expect(data.account).toMatchObject({ email: "alex.rivera@example.com", name: "Alex Rivera" });
    expect(data.profile?.firstName).toBe("Alex");
    expect(data.masterResume?.versions.length).toBeGreaterThan(0);
    expect(data.masterCoverLetter).not.toBeNull();
    expect(data.applications).toHaveLength(1);
    expect(data.applications[0]).toMatchObject({ job: { id: job.id } });
    expect(data.applications[0]!.resume?.versions.length).toBeGreaterThan(0);
    expect(data.applications[0]!.match).not.toBeNull();
    expect(data.credits.balance).toBeLessThan(1840);
    expect(data.credits.history.length).toBeGreaterThan(0);
    expect(data.aiActions.length).toBeGreaterThan(0);
    expect(JSON.stringify(data)).not.toContain("secret-hash-value");
    expect(JSON.stringify(data)).not.toContain("passwordHash");
  });

  it("has nothing for someone who doesn't exist", async () => {
    expect(await exportAccountData(new MemoryAppStore(), "usr_nobody")).toBeNull();
  });
});

describe("delete my account", () => {
  it("needs the person's own email typed first (any capitals, extra spaces)", async () => {
    const { store, id } = await withData();
    expect(await deleteAccount(store, id, "someone-else@example.com")).toBe(false);
    expect(await deleteAccount(store, id, "")).toBe(false);
    expect(await store.getUser(id)).not.toBeNull();

    expect(await deleteAccount(store, id, "  Alex.Rivera@Example.com ")).toBe(true);
    expect(await store.getUser(id)).toBeNull();
    expect(await store.findProfile(id)).toBeNull();
    expect(await store.listJobs(id)).toEqual([]);
    expect(await store.credits.balance(id)).toBe(0);
  });
});
