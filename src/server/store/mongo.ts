import type { Collection, Db, Document, MongoClient } from "mongodb";
import type { AIRunRecord } from "@/server/ai/runner";
import { MongoCreditStore } from "@/server/credits/mongo-store";
import { CreditService } from "@/server/credits/service";
import type { ProfileSnapshot } from "@/server/domain/profile";
import type { ErrorEntry, ErrorInput, ErrorSummary } from "@/server/admin/errors";
import type { Purchase, PurchaseInput, RunningCost } from "@/server/admin/money";
import type { AdminSnapshot, SecurityEvent, SecuritySummary } from "@/server/admin/overview";
import type { AdminRecord, AnalysisRecord, AppStore, AtsRecord, CoverLetterRecord, CvImport, JobRecord, MatchRecord, ResumeRecord, UserRecord } from "./types";

type Doc = Document;
const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
let seq = 0;
/** Strictly increasing within a process, so two records written in the same millisecond keep their order. */
const tick = () => Date.now() * 1000 + (seq++ % 1000);
const isDuplicate = (e: unknown) => (e as { code?: number })?.code === 11000;

/** `_id` is the app's own string id; rows read back with `id`, and `drop` removes bookkeeping fields. */
function row<T>(d: Doc | null, drop: string[] = []): T | null {
  if (!d) return null;
  const { _id, ...rest } = d;
  for (const k of drop) delete rest[k];
  return { id: _id, ...rest } as T;
}

/**
 * MongoDB AppStore (Atlas). Same contract and behavior as MemoryAppStore, so the rest of the app can't tell them apart.
 *  - Every query includes userId: there is no way to read or change another user's record.
 *  - Ids are the app's own strings (job_…, res_…) stored as _id.
 *  - Versions are appended with a single atomic update, so two edits at once never share a version number.
 *  - Profile data stays one document per user; AI outputs are stored whole, as they were validated.
 */
export class MongoAppStore implements AppStore {
  readonly credits: CreditService;
  private readonly creditStore: MongoCreditStore;

  private users: Collection<Doc>;
  private resets: Collection<Doc>;
  private hits: Collection<Doc>;
  private profiles: Collection<Doc>;
  private cvImports: Collection<Doc>;
  private jobs: Collection<Doc>;
  private analyses: Collection<Doc>;
  private matches: Collection<Doc>;
  private atsReports: Collection<Doc>;
  private resumes: Collection<Doc>;
  private letters: Collection<Doc>;
  private runs: Collection<Doc>;
  private admins: Collection<Doc>;
  private events: Collection<Doc>;
  private errorLog: Collection<Doc>;
  private purchases: Collection<Doc>;
  private runningCosts: Collection<Doc>;

  constructor(
    client: MongoClient,
    private readonly db: Db,
  ) {
    this.creditStore = new MongoCreditStore(client, db);
    this.credits = new CreditService(this.creditStore);
    this.users = db.collection("users");
    this.resets = db.collection("password_resets");
    this.hits = db.collection("rate_limits");
    this.profiles = db.collection("profiles");
    this.cvImports = db.collection("cv_imports");
    this.jobs = db.collection("jobs");
    this.analyses = db.collection("analyses");
    this.matches = db.collection("matches");
    this.atsReports = db.collection("ats_reports");
    this.resumes = db.collection("resumes");
    this.letters = db.collection("cover_letters");
    this.runs = db.collection("ai_runs");
    this.admins = db.collection("admins");
    this.events = db.collection("security_events");
    this.errorLog = db.collection("error_logs");
    this.purchases = db.collection("purchases");
    this.runningCosts = db.collection("running_costs");
  }

  /** Idempotent: safe to run on every cold start. */
  async ensureIndexes() {
    await Promise.all([
      this.users.createIndex({ email: 1 }, { unique: true }),
      this.resets.createIndex({ userId: 1 }),
      this.hits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }), // each counter disappears when its window is over
      this.resets.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 86_400 }), // used and expired links disappear a day after they stop working
      this.jobs.createIndex({ userId: 1, updatedAt: -1 }),
      this.analyses.createIndex({ userId: 1, jobId: 1, createdAt: -1 }),
      this.matches.createIndex({ userId: 1, jobId: 1, createdAt: -1 }),
      this.atsReports.createIndex({ userId: 1, jobId: 1, createdAt: -1 }),
      // One Master document per user (jobId null) and one per job.
      this.resumes.createIndex({ userId: 1, jobId: 1 }, { unique: true }),
      this.resumes.createIndex({ userId: 1, updatedAt: -1 }),
      this.letters.createIndex({ userId: 1, jobId: 1 }, { unique: true }),
      this.letters.createIndex({ userId: 1, updatedAt: -1 }),
      this.runs.createIndex({ userId: 1, createdAt: -1 }),
      this.runs.createIndex({ createdAt: -1 }),
      this.events.createIndex({ at: 1 }, { expireAfterSeconds: 30 * 86_400 }), // security events are kept for 30 days
      this.errorLog.createIndex({ at: 1 }, { expireAfterSeconds: 30 * 86_400 }), // so is the error log
      this.errorLog.createIndex({ userId: 1 }),
      this.purchases.createIndex({ at: -1 }),
      this.errorLog.createIndex({ source: 1, code: 1 }),
      this.creditStore.ensureIndexes(),
    ]);
  }

  aiRuns = {
    record: async (run: Omit<AIRunRecord, "id" | "createdAt">) => {
      const rec = { ...run, id: newId("run"), createdAt: new Date() };
      const { id, ...rest } = rec;
      await this.runs.insertOne({ _id: id as never, ...rest, ts: tick() });
      return rec;
    },
    listForUser: async (userId: string) => {
      const rows = await this.runs.find({ userId }).sort({ createdAt: 1, ts: 1 }).toArray();
      return rows.map((r) => row<AIRunRecord>(r, ["ts"])!);
    },
  };

  // ───────────── Users ─────────────

  async createUser(u: { email: string; name: string; passwordHash: string | null }) {
    const rec: UserRecord = { id: newId("usr"), email: u.email.trim().toLowerCase(), name: u.name.trim(), passwordHash: u.passwordHash, createdAt: new Date() };
    const { id, ...rest } = rec;
    try {
      await this.users.insertOne({ _id: id as never, ...rest });
    } catch (e) {
      if (isDuplicate(e)) throw new Error("An account with this email already exists.");
      throw e;
    }
    return rec;
  }
  async findUserByEmail(email: string) {
    return row<UserRecord>(await this.users.findOne({ email: email.trim().toLowerCase() }));
  }
  async getUser(userId: string) {
    return row<UserRecord>(await this.users.findOne({ _id: userId as never }));
  }

  // ───────────── Operator (admin dashboard) ─────────────

  async adminSnapshot(): Promise<AdminSnapshot> {
    const [users, profiles, jobs, resumes, letters, matches] = await Promise.all([
      this.users.find({}, { projection: { name: 1, email: 1, createdAt: 1 } }).toArray(),
      this.profiles.find({}, { projection: { _id: 1 } }).toArray(),
      this.jobs.find({}, { projection: { userId: 1, appliedAt: 1, updatedAt: 1 } }).toArray(),
      this.resumes.find({ jobId: { $ne: null } }, { projection: { userId: 1, jobId: 1, updatedAt: 1 } }).toArray(),
      this.letters.find({ jobId: { $ne: null } }, { projection: { userId: 1, jobId: 1, updatedAt: 1 } }).toArray(),
      this.matches.find({}, { projection: { userId: 1, jobId: 1, overallScore: 1, createdAt: 1 } }).toArray(),
    ]);
    return {
      users: users.map((u) => ({ id: String(u._id), name: u.name, email: u.email, createdAt: u.createdAt })),
      profileUserIds: profiles.map((p) => String(p._id)),
      jobs: jobs.map((j) => ({ id: String(j._id), userId: j.userId, appliedAt: j.appliedAt ?? null, updatedAt: j.updatedAt })),
      documents: [...resumes, ...letters].map((d) => ({ userId: d.userId, jobId: d.jobId, updatedAt: d.updatedAt })),
      matches: matches.map((x) => ({ userId: x.userId, jobId: x.jobId, overallScore: x.overallScore, createdAt: x.createdAt })),
    };
  }
  async aiRunStats(since: Date) {
    const [total, failed] = await Promise.all([this.runs.countDocuments({ createdAt: { $gte: since } }), this.runs.countDocuments({ createdAt: { $gte: since }, status: "FAILED" })]);
    return { total, failed };
  }
  async recordSecurityEvent(event: SecurityEvent) {
    await this.events.insertOne({ type: event.type, ...(event.rule ? { rule: event.rule } : {}), at: event.at });
  }
  async securitySummary(since: Date, recentLimit = 10): Promise<SecuritySummary> {
    const [failed, limited, removed, recent] = await Promise.all([
      this.events.countDocuments({ type: "sign_in_failed", at: { $gte: since } }),
      this.events.countDocuments({ type: "rate_limited", at: { $gte: since } }),
      this.events.countDocuments({ type: "account_removed", at: { $gte: since } }),
      this.events.find({ at: { $gte: since } }).sort({ at: -1 }).limit(recentLimit).toArray(),
    ]);
    return { counts: { sign_in_failed: failed, rate_limited: limited, account_removed: removed }, recent: recent.map((e) => ({ type: e.type, ...(e.rule ? { rule: e.rule } : {}), at: e.at })) };
  }
  async recordPurchase(p: PurchaseInput) {
    await this.purchases.insertOne({ _id: newId("buy") as never, at: p.at, kind: p.kind, name: p.name, cents: p.cents, credits: p.credits });
  }
  async listPurchases(since: Date) {
    return (await this.purchases.find({ at: { $gte: since } }).sort({ at: -1 }).toArray()).map((r) => row<Purchase>(r)!);
  }
  async aiCostSince(since: Date) {
    const [r] = await this.runs.aggregate<{ costUsd: number; runs: number }>([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: null, costUsd: { $sum: "$costUsd" }, runs: { $sum: 1 } } }]).toArray();
    return { costUsd: r?.costUsd ?? 0, runs: r?.runs ?? 0 };
  }
  async creditTotalsSince(since: Date) {
    return this.creditStore.totalsSince(since);
  }
  async listRunningCosts() {
    return (await this.runningCosts.find({}).sort({ _id: 1 }).toArray()).map((r) => row<RunningCost>(r)!);
  }
  async addRunningCost(label: string, cents: number) {
    const rec = { id: newId("cost"), label, cents };
    await this.runningCosts.insertOne({ _id: rec.id as never, label, cents });
    return rec;
  }
  async removeRunningCost(costId: string) {
    return (await this.runningCosts.deleteOne({ _id: costId as never })).deletedCount > 0;
  }
  async recordError(entry: ErrorInput) {
    await this.errorLog.insertOne({ _id: newId("err") as never, source: entry.source, code: entry.code, message: entry.message, userId: entry.userId, at: entry.at, ...(entry.path ? { path: entry.path } : {}) });
  }
  async errorSummary(since: Date, limit = 200): Promise<ErrorSummary> {
    const [total, rows] = await Promise.all([this.errorLog.countDocuments({ at: { $gte: since } }), this.errorLog.find({ at: { $gte: since } }).sort({ at: -1 }).limit(limit).toArray()]);
    return { total, entries: rows.map((r) => row<ErrorEntry>(r)!) };
  }
  async listErrorsForUser(userId: string) {
    return (await this.errorLog.find({ userId }).sort({ at: -1 }).toArray()).map((r) => row<ErrorEntry>(r)!);
  }
  async clearErrors(source: string, code: string) {
    return (await this.errorLog.deleteMany({ source, code })).deletedCount;
  }
  async listAdmins(): Promise<AdminRecord[]> {
    const rows = await this.admins.find({}).sort({ addedAt: -1 }).toArray();
    const users = rows.length ? await this.users.find({ _id: { $in: rows.map((r) => r._id) } }, { projection: { name: 1, email: 1 } }).toArray() : [];
    const byId = new Map(users.map((u) => [String(u._id), u]));
    return rows.flatMap((r) => {
      const u = byId.get(String(r._id));
      return u ? [{ userId: String(r._id), name: u.name, email: u.email, addedAt: r.addedAt }] : [];
    });
  }
  async isAdminUser(userId: string) {
    return (await this.admins.countDocuments({ _id: userId as never }, { limit: 1 })) > 0;
  }
  async addAdminUser(userId: string, addedBy: string) {
    await this.admins.updateOne({ _id: userId as never }, { $setOnInsert: { addedBy, addedAt: new Date() } }, { upsert: true });
  }
  async removeAdminUser(userId: string) {
    return (await this.admins.deleteOne({ _id: userId as never })).deletedCount > 0;
  }

  async deleteProfile(userId: string) {
    await Promise.all([this.resumes.deleteMany({ userId, jobId: null }), this.letters.deleteMany({ userId, jobId: null })]);
    await Promise.all([this.profiles.deleteOne({ _id: userId as never }), this.cvImports.deleteOne({ _id: userId as never })]); // profile last: if anything above failed it still exists and can be deleted again
  }

  async deleteAccount(userId: string) {
    await Promise.all([this.analyses, this.matches, this.atsReports, this.resumes, this.letters, this.jobs, this.runs, this.resets].map((c) => c.deleteMany({ userId })));
    await Promise.all([this.profiles.deleteOne({ _id: userId as never }), this.cvImports.deleteOne({ _id: userId as never })]);
    await this.creditStore.deleteForUser(userId);
    await this.admins.deleteOne({ _id: userId as never });
    await this.errorLog.deleteMany({ userId });
    await this.users.deleteOne({ _id: userId as never }); // last: if anything above failed, the account still exists and the user can try again
  }

  async createPasswordReset(userId: string, tokenHash: string, createdAt: Date, expiresAt: Date) {
    await this.resets.deleteMany({ userId });
    await this.resets.insertOne({ _id: tokenHash as never, userId, createdAt, expiresAt, usedAt: null });
  }
  async lastPasswordResetAt(userId: string) {
    const d = await this.resets.find({ userId }).sort({ createdAt: -1 }).limit(1).next();
    return (d?.createdAt as Date | undefined) ?? null;
  }
  async findPasswordReset(tokenHash: string, now: Date) {
    const d = await this.resets.findOne({ _id: tokenHash as never, usedAt: null, expiresAt: { $gt: now } });
    return d ? { userId: d.userId as string } : null;
  }
  async consumePasswordReset(tokenHash: string, now: Date) {
    // One atomic update: only the first request finds it unused.
    const d = await this.resets.findOneAndUpdate({ _id: tokenHash as never, usedAt: null, expiresAt: { $gt: now } }, { $set: { usedAt: now } });
    return d ? { userId: d.userId as string } : null;
  }
  async hitRateLimit(key: string, windowMs: number, now: Date) {
    const bucket = Math.floor(+now / windowMs);
    const filter = { _id: `${key}:${bucket}` as never };
    const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * windowMs) } };
    for (let attempt = 0; ; attempt++) {
      try {
        const d = await this.hits.findOneAndUpdate(filter, update, { upsert: true, returnDocument: "after" });
        return (d?.count as number | undefined) ?? 1;
      } catch (e) {
        if (!isDuplicate(e) || attempt > 1) throw e; // two first hits at once: the other one created it, so just count again
      }
    }
  }
  async setPasswordHash(userId: string, passwordHash: string) {
    const r = await this.users.updateOne({ _id: userId as never }, { $set: { passwordHash } });
    return r.matchedCount === 1;
  }

  // ───────────── Profile ─────────────

  async getProfile(userId: string) {
    const p = await this.findProfile(userId);
    if (!p) throw new Error("Profile not found");
    return p;
  }
  async findProfile(userId: string) {
    const d = await this.profiles.findOne({ _id: userId as never });
    if (!d) return null;
    const { _id, ...profile } = d;
    return profile as unknown as ProfileSnapshot;
  }
  async saveProfile(userId: string, profile: ProfileSnapshot) {
    // Approved gap answers live with the profile but are managed by the match flow, so keep the stored ones.
    const { approvedFacts, ...rest } = profile;
    await this.profiles.updateOne({ _id: userId as never }, { $set: rest, $setOnInsert: { approvedFacts } }, { upsert: true });
  }

  async getCvImport(userId: string) {
    const d = await this.cvImports.findOne({ _id: userId as never });
    return d ? ({ fileName: d.fileName, draft: d.draft, createdAt: d.createdAt } as CvImport) : null;
  }
  async setCvImport(userId: string, value: CvImport | null) {
    if (value) await this.cvImports.replaceOne({ _id: userId as never }, { ...value }, { upsert: true });
    else await this.cvImports.deleteOne({ _id: userId as never });
  }

  async addApprovedFact(userId: string, fact: Parameters<AppStore["addApprovedFact"]>[1]) {
    const rec = { id: newId("fact"), topic: fact.topic, question: fact.question, answer: fact.answer, status: fact.status };
    // One answer per topic: drop any earlier one and add this, in a single atomic update. $literal keeps
    // text that starts with "$" (like "$5,000 saved") from being read as a field reference.
    const res = await this.profiles.updateOne({ _id: userId as never }, [
      {
        $set: {
          approvedFacts: {
            $concatArrays: [{ $filter: { input: { $ifNull: ["$approvedFacts", []] }, as: "f", cond: { $ne: ["$$f.topic", { $literal: fact.topic }] } } }, [{ $literal: rec }]],
          },
        },
      },
    ]);
    if (!res.matchedCount) throw new Error("Profile not found");
    return rec;
  }

  async updateApprovedFacts(userId: string, edits: Parameters<AppStore["updateApprovedFacts"]>[1]) {
    if (!(await this.profiles.countDocuments({ _id: userId as never }, { limit: 1 }))) throw new Error("Profile not found");
    for (const e of edits) {
      await this.profiles.updateOne({ _id: userId as never, "approvedFacts.id": e.id }, { $set: { "approvedFacts.$.status": e.status, "approvedFacts.$.answer": e.answer } });
    }
  }

  // ───────────── Jobs ─────────────

  async createJob(userId: string, job: Parameters<AppStore["createJob"]>[1]) {
    const now = new Date();
    const rec: JobRecord = { ...job, id: newId("job"), userId, status: "DRAFT", createdAt: now, updatedAt: now };
    const { id, ...rest } = rec;
    await this.jobs.insertOne({ _id: id as never, ...rest });
    return rec;
  }
  async getJob(userId: string, jobId: string) {
    return row<JobRecord>(await this.jobs.findOne({ _id: jobId as never, userId }));
  }
  async listJobs(userId: string) {
    return (await this.jobs.find({ userId }).sort({ updatedAt: -1 }).toArray()).map((d) => row<JobRecord>(d)!);
  }
  async setJobStatus(userId: string, jobId: string, status: JobRecord["status"]) {
    await this.jobs.updateOne({ _id: jobId as never, userId }, { $set: { status, updatedAt: new Date() } });
  }
  async setJobApplied(userId: string, jobId: string, applied: boolean, now = new Date()) {
    const res = await this.jobs.updateOne({ _id: jobId as never, userId }, { $set: { appliedAt: applied ? now : null } });
    return res.matchedCount > 0;
  }
  async deleteJob(userId: string, jobId: string) {
    const res = await this.jobs.deleteOne({ _id: jobId as never, userId });
    if (!res.deletedCount) return false;
    await Promise.all([this.analyses, this.matches, this.atsReports, this.resumes, this.letters].map((c) => c.deleteMany({ userId, jobId })));
    return true;
  }

  async deleteResume(userId: string, resumeId: string) {
    return Boolean((await this.resumes.deleteOne({ _id: resumeId as never, userId })).deletedCount);
  }
  async deleteCoverLetter(userId: string, letterId: string) {
    return Boolean((await this.letters.deleteOne({ _id: letterId as never, userId })).deletedCount);
  }

  private async requireJob(userId: string, jobId: string) {
    if (!(await this.jobs.countDocuments({ _id: jobId as never, userId }, { limit: 1 }))) throw new Error("Job not found");
  }
  /** Reads are scoped by userId too, so a guessed jobId from another account returns nothing. */
  private async latest<T>(coll: Collection<Doc>, userId: string, jobId: string) {
    return row<T>((await coll.find({ userId, jobId }).sort({ createdAt: -1, ts: -1 }).limit(1).toArray())[0] ?? null, ["userId", "ts"]);
  }

  async saveAnalysis(userId: string, a: Omit<AnalysisRecord, "id" | "createdAt">) {
    await this.requireJob(userId, a.jobId);
    const rec: AnalysisRecord = { ...a, id: newId("ana"), createdAt: new Date() };
    const { id, ...rest } = rec;
    await this.analyses.insertOne({ _id: id as never, userId, ...rest, ts: tick() });
    return rec;
  }
  latestAnalysis(userId: string, jobId: string) {
    return this.latest<AnalysisRecord>(this.analyses, userId, jobId);
  }

  async saveMatch(userId: string, m: Omit<MatchRecord, "id" | "createdAt">) {
    await this.requireJob(userId, m.jobId);
    const rec: MatchRecord = { ...m, id: newId("mat"), createdAt: new Date() };
    const { id, ...rest } = rec;
    await this.matches.insertOne({ _id: id as never, userId, ...rest, ts: tick() });
    return rec;
  }
  latestMatch(userId: string, jobId: string) {
    return this.latest<MatchRecord>(this.matches, userId, jobId);
  }

  async saveAts(userId: string, m: Omit<AtsRecord, "id" | "createdAt">) {
    await this.requireJob(userId, m.jobId);
    const rec: AtsRecord = { ...m, id: newId("ats"), createdAt: new Date() };
    const { id, ...rest } = rec;
    await this.atsReports.insertOne({ _id: id as never, userId, ...rest, ts: tick() });
    return rec;
  }
  latestAts(userId: string, jobId: string) {
    return this.latest<AtsRecord>(this.atsReports, userId, jobId);
  }

  // ───────────── Resumes and cover letters (immutable versions) ─────────────

  async resumeForJob(userId: string, jobId: string | null) {
    return row<ResumeRecord>(await this.resumes.findOne({ userId, jobId }));
  }
  async listResumes(userId: string) {
    return (await this.resumes.find({ userId }).sort({ updatedAt: -1 }).toArray()).map((d) => row<ResumeRecord>(d)!);
  }
  addResumeVersion(userId: string, jobId: string | null, v: Parameters<AppStore["addResumeVersion"]>[2]) {
    return this.appendVersion<ResumeRecord>(this.resumes, "res", "rv", userId, jobId, v.name, { label: v.label, content: v.content, changeNotes: v.changeNotes });
  }
  async restoreResumeVersion(userId: string, resumeId: string, versionId: string) {
    const r = row<ResumeRecord>(await this.resumes.findOne({ _id: resumeId as never, userId }));
    const old = r?.versions.find((v) => v.id === versionId);
    if (!r || !old) throw new Error("Version not found");
    // Restore copies forward: history is never rewritten.
    return this.addResumeVersion(userId, r.jobId, {
      label: "USER_EDITED",
      content: structuredClone(old.content),
      changeNotes: [`Restored from version ${old.number}`],
      name: r.name,
    });
  }

  async coverLetterForJob(userId: string, jobId: string | null) {
    return row<CoverLetterRecord>(await this.letters.findOne({ userId, jobId }));
  }
  async listCoverLetters(userId: string) {
    return (await this.letters.find({ userId }).sort({ updatedAt: -1 }).toArray()).map((d) => row<CoverLetterRecord>(d)!);
  }
  addCoverLetterVersion(userId: string, jobId: string | null, v: Parameters<AppStore["addCoverLetterVersion"]>[2]) {
    return this.appendVersion<CoverLetterRecord>(this.letters, "cl", "clv", userId, jobId, v.name, { label: v.label, content: v.content, tone: v.tone, changeNotes: [] });
  }

  /**
   * Adds a version to the document for (user, job), creating the document first if needed. The version
   * number is computed inside the update from the array length, so concurrent writers can't collide.
   */
  private async appendVersion<T>(coll: Collection<Doc>, prefix: string, versionPrefix: string, userId: string, jobId: string | null, name: string, body: Doc) {
    const now = new Date();
    if (!(await coll.countDocuments({ userId, jobId }, { limit: 1 }))) {
      try {
        await coll.insertOne({ _id: newId(prefix) as never, userId, jobId, name, versions: [], currentVersionId: "", createdAt: now, updatedAt: now });
      } catch (e) {
        if (!isDuplicate(e)) throw e; // someone created it a moment ago: carry on and append to theirs
      }
    }
    const versionId = newId(versionPrefix);
    const versions = { $ifNull: ["$versions", []] };
    const updated = await coll.findOneAndUpdate(
      { userId, jobId },
      [
        {
          $set: {
            versions: {
              $concatArrays: [versions, [{ $mergeObjects: [{ $literal: { id: versionId, ...body, createdAt: now } }, { number: { $add: [{ $size: versions }, 1] } }] }]],
            },
            currentVersionId: { $literal: versionId },
            updatedAt: { $literal: now },
          },
        },
      ],
      { returnDocument: "after" },
    );
    return row<T>(updated)!;
  }
}
