import { randomUUID } from "node:crypto";
import type { AIRunRecord } from "@/server/ai/runner";
import { MemoryCreditStore } from "@/server/credits/memory-store";
import { CreditService } from "@/server/credits/service";
import type { ProfileSnapshot } from "@/server/domain/profile";
import type { ErrorEntry, ErrorInput, ErrorSummary } from "@/server/admin/errors";
import type { AdminSnapshot, SecurityEvent, SecuritySummary } from "@/server/admin/overview";
import type { AdminRecord, AnalysisRecord, AppStore, AtsRecord, CoverLetterRecord, CvImport, JobRecord, MatchRecord, ResumeRecord, UserRecord } from "./types";

const id = (prefix: string) => `${prefix}_${randomUUID().slice(0, 8)}`;
const latest = <T extends { createdAt: Date }>(rows: T[]) => rows.sort((a, b) => +b.createdAt - +a.createdAt)[0] ?? null;

/** In-memory AppStore, used when no MONGODB_URI is set. Data resets when the server restarts. */
export class MemoryAppStore implements AppStore {
  private creditStore = new MemoryCreditStore();
  credits = new CreditService(this.creditStore);

  private users: UserRecord[] = [];
  private hits = new Map<string, { count: number; expiresAt: number }>();
  private resets = new Map<string, { userId: string; createdAt: Date; expiresAt: Date; usedAt: Date | null }>();
  private cvImports = new Map<string, CvImport>();
  private profiles = new Map<string, ProfileSnapshot>();
  private jobs: JobRecord[] = [];
  private analyses: AnalysisRecord[] = [];
  private matches: MatchRecord[] = [];
  private atsReports: AtsRecord[] = [];
  private resumes: ResumeRecord[] = [];
  private letters: CoverLetterRecord[] = [];
  private runs: AIRunRecord[] = [];
  private admins: Array<{ userId: string; addedBy: string; addedAt: Date }> = [];
  private events: SecurityEvent[] = [];
  private errors: ErrorEntry[] = [];

  aiRuns = {
    record: async (run: Omit<AIRunRecord, "id" | "createdAt">) => {
      const rec = { ...run, id: id("run"), createdAt: new Date() };
      this.runs.push(rec);
      return rec;
    },
    listForUser: async (userId: string) => this.runs.filter((r) => r.userId === userId),
  };

  async adminSnapshot(): Promise<AdminSnapshot> {
    const owner = new Map(this.jobs.map((j) => [j.id, j.userId]));
    return {
      users: this.users.map((u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt })),
      profileUserIds: [...this.profiles.keys()],
      jobs: this.jobs.map((j) => ({ id: j.id, userId: j.userId, appliedAt: j.appliedAt ?? null, updatedAt: j.updatedAt })),
      documents: [...this.resumes, ...this.letters].flatMap((d) => (d.jobId ? [{ userId: d.userId, jobId: d.jobId, updatedAt: d.updatedAt }] : [])),
      matches: this.matches.flatMap((x) => (owner.has(x.jobId) ? [{ userId: owner.get(x.jobId)!, jobId: x.jobId, overallScore: x.overallScore, createdAt: x.createdAt }] : [])),
    };
  }
  async aiRunStats(since: Date) {
    const runs = this.runs.filter((r) => +r.createdAt >= +since);
    return { total: runs.length, failed: runs.filter((r) => r.status === "FAILED").length };
  }
  async recordSecurityEvent(event: SecurityEvent) {
    this.events.push({ ...event });
    this.events = this.events.filter((e) => +event.at - +e.at <= 30 * 86_400_000);
  }
  async securitySummary(since: Date, recentLimit = 10): Promise<SecuritySummary> {
    const rows = this.events.filter((e) => +e.at >= +since).sort((a, b) => +b.at - +a.at);
    return {
      counts: {
        sign_in_failed: rows.filter((e) => e.type === "sign_in_failed").length,
        rate_limited: rows.filter((e) => e.type === "rate_limited").length,
        account_removed: rows.filter((e) => e.type === "account_removed").length,
      },
      recent: rows.slice(0, recentLimit).map((e) => ({ ...e })),
    };
  }
  async recordError(entry: ErrorInput) {
    this.errors.push({ ...entry, id: id("err") });
    this.errors = this.errors.filter((e) => +entry.at - +e.at <= 30 * 86_400_000);
  }
  async errorSummary(since: Date, limit = 200): Promise<ErrorSummary> {
    const rows = this.errors.filter((e) => +e.at >= +since).sort((a, b) => +b.at - +a.at);
    return { total: rows.length, entries: rows.slice(0, limit).map((e) => ({ ...e })) };
  }
  async listErrorsForUser(userId: string) {
    return this.errors.filter((e) => e.userId === userId).sort((a, b) => +b.at - +a.at).map((e) => ({ ...e }));
  }
  async clearErrors(source: string, code: string) {
    const before = this.errors.length;
    this.errors = this.errors.filter((e) => !(e.source === source && e.code === code));
    return before - this.errors.length;
  }
  async listAdmins(): Promise<AdminRecord[]> {
    return this.admins
      .flatMap((a) => {
        const u = this.users.find((x) => x.id === a.userId);
        return u ? [{ userId: u.id, name: u.name, email: u.email, addedAt: a.addedAt }] : [];
      })
      .sort((a, b) => +b.addedAt - +a.addedAt);
  }
  async isAdminUser(userId: string) {
    return this.admins.some((a) => a.userId === userId);
  }
  async addAdminUser(userId: string, addedBy: string) {
    if (!this.admins.some((a) => a.userId === userId)) this.admins.push({ userId, addedBy, addedAt: new Date() });
  }
  async removeAdminUser(userId: string) {
    const before = this.admins.length;
    this.admins = this.admins.filter((a) => a.userId !== userId);
    return this.admins.length < before;
  }

  async getCvImport(userId: string) {
    return this.cvImports.get(userId) ?? null;
  }
  async setCvImport(userId: string, value: CvImport | null) {
    if (value) this.cvImports.set(userId, value);
    else this.cvImports.delete(userId);
  }

  async createUser(u: { email: string; name: string; passwordHash: string | null }) {
    const email = u.email.trim().toLowerCase();
    if (await this.findUserByEmail(email)) throw new Error("An account with this email already exists.");
    const rec: UserRecord = { id: id("usr"), email, name: u.name.trim(), passwordHash: u.passwordHash, createdAt: new Date() };
    this.users.push(rec);
    return rec;
  }
  async findUserByEmail(email: string) {
    return this.users.find((x) => x.email === email.trim().toLowerCase()) ?? null;
  }
  async getUser(userId: string) {
    return this.users.find((x) => x.id === userId) ?? null;
  }

  async deleteProfile(userId: string) {
    this.profiles.delete(userId);
    this.cvImports.delete(userId);
    this.resumes = this.resumes.filter((r) => !(r.userId === userId && r.jobId === null));
    this.letters = this.letters.filter((l) => !(l.userId === userId && l.jobId === null));
  }

  async deleteAccount(userId: string) {
    const jobIds = new Set(this.jobs.filter((j) => j.userId === userId).map((j) => j.id));
    this.jobs = this.jobs.filter((j) => j.userId !== userId);
    this.analyses = this.analyses.filter((a) => !jobIds.has(a.jobId));
    this.matches = this.matches.filter((m) => !jobIds.has(m.jobId));
    this.atsReports = this.atsReports.filter((r) => !jobIds.has(r.jobId));
    this.resumes = this.resumes.filter((r) => r.userId !== userId);
    this.letters = this.letters.filter((l) => l.userId !== userId);
    this.runs = this.runs.filter((r) => r.userId !== userId);
    this.admins = this.admins.filter((a) => a.userId !== userId);
    this.errors = this.errors.filter((e) => e.userId !== userId);
    this.profiles.delete(userId);
    this.cvImports.delete(userId);
    for (const [k, v] of this.resets) if (v.userId === userId) this.resets.delete(k);
    this.users = this.users.filter((u) => u.id !== userId);
    await this.creditStore.deleteForUser(userId);
  }

  async createPasswordReset(userId: string, tokenHash: string, createdAt: Date, expiresAt: Date) {
    for (const [k, v] of this.resets) if (v.userId === userId) this.resets.delete(k);
    this.resets.set(tokenHash, { userId, createdAt, expiresAt, usedAt: null });
  }
  async lastPasswordResetAt(userId: string) {
    return [...this.resets.values()].filter((v) => v.userId === userId).sort((a, b) => +b.createdAt - +a.createdAt)[0]?.createdAt ?? null;
  }
  async findPasswordReset(tokenHash: string, now: Date) {
    const r = this.resets.get(tokenHash);
    return r && !r.usedAt && r.expiresAt > now ? { userId: r.userId } : null;
  }
  async consumePasswordReset(tokenHash: string, now: Date) {
    const r = this.resets.get(tokenHash);
    if (!r || r.usedAt || r.expiresAt <= now) return null;
    r.usedAt = now; // synchronous: two requests can't both pass the check above
    return { userId: r.userId };
  }
  async hitRateLimit(key: string, windowMs: number, now: Date) {
    const bucket = Math.floor(+now / windowMs);
    const id = `${key}:${bucket}`;
    const h = this.hits.get(id) ?? { count: 0, expiresAt: (bucket + 1) * windowMs };
    h.count += 1;
    this.hits.set(id, h);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (v.expiresAt < +now) this.hits.delete(k);
    return h.count;
  }
  async setPasswordHash(userId: string, passwordHash: string) {
    const u = this.users.find((x) => x.id === userId);
    if (!u) return false;
    u.passwordHash = passwordHash;
    return true;
  }

  private own<T extends { userId: string }>(rows: T[], userId: string) {
    return rows.filter((r) => r.userId === userId);
  }
  private ownedJobIds(userId: string) {
    return new Set(this.own(this.jobs, userId).map((j) => j.id));
  }

  async getProfile(userId: string) {
    const p = this.profiles.get(userId);
    if (!p) throw new Error("Profile not found");
    return structuredClone(p);
  }
  async findProfile(userId: string) {
    const p = this.profiles.get(userId);
    return p ? structuredClone(p) : null;
  }
  async saveProfile(userId: string, profile: ProfileSnapshot) {
    // Approved gap answers live with the profile but are managed by the match flow, so keep them.
    const existing = this.profiles.get(userId);
    this.profiles.set(userId, structuredClone({ ...profile, approvedFacts: existing?.approvedFacts ?? profile.approvedFacts }));
  }

  async addApprovedFact(userId: string, fact: Parameters<AppStore["addApprovedFact"]>[1]) {
    const p = this.profiles.get(userId);
    if (!p) throw new Error("Profile not found");
    const rec = { id: id("fact"), topic: fact.topic, question: fact.question, answer: fact.answer, status: fact.status };
    p.approvedFacts = [...p.approvedFacts.filter((f) => f.topic !== fact.topic), rec];
    return rec;
  }

  async updateApprovedFacts(userId: string, edits: Parameters<AppStore["updateApprovedFacts"]>[1]) {
    const p = this.profiles.get(userId);
    if (!p) throw new Error("Profile not found");
    for (const e of edits) {
      const f = p.approvedFacts.find((x) => x.id === e.id);
      if (f) Object.assign(f, { status: e.status, answer: e.answer });
    }
  }

  async createJob(userId: string, job: Parameters<AppStore["createJob"]>[1]) {
    const now = new Date();
    const rec: JobRecord = { ...job, id: id("job"), userId, status: "DRAFT", createdAt: now, updatedAt: now };
    this.jobs.push(rec);
    return rec;
  }
  async getJob(userId: string, jobId: string) {
    return this.own(this.jobs, userId).find((j) => j.id === jobId) ?? null;
  }
  async listJobs(userId: string) {
    return this.own(this.jobs, userId).sort((a, b) => +b.updatedAt - +a.updatedAt);
  }
  async deleteJob(userId: string, jobId: string) {
    if (!(await this.getJob(userId, jobId))) return false;
    this.jobs = this.jobs.filter((j) => j.id !== jobId);
    this.analyses = this.analyses.filter((a) => a.jobId !== jobId);
    this.matches = this.matches.filter((m) => m.jobId !== jobId);
    this.atsReports = this.atsReports.filter((r) => r.jobId !== jobId);
    this.resumes = this.resumes.filter((r) => r.jobId !== jobId);
    this.letters = this.letters.filter((l) => l.jobId !== jobId);
    return true;
  }
  async deleteResume(userId: string, resumeId: string) {
    if (!this.own(this.resumes, userId).some((r) => r.id === resumeId)) return false;
    this.resumes = this.resumes.filter((r) => r.id !== resumeId);
    return true;
  }
  async deleteCoverLetter(userId: string, letterId: string) {
    if (!this.own(this.letters, userId).some((l) => l.id === letterId)) return false;
    this.letters = this.letters.filter((l) => l.id !== letterId);
    return true;
  }
  async setJobStatus(userId: string, jobId: string, status: JobRecord["status"]) {
    const j = await this.getJob(userId, jobId);
    if (j) Object.assign(j, { status, updatedAt: new Date() });
  }

  async setJobApplied(userId: string, jobId: string, applied: boolean, now = new Date()) {
    const j = await this.getJob(userId, jobId);
    if (!j) return false;
    j.appliedAt = applied ? now : null;
    return true;
  }

  async saveAnalysis(userId: string, a: Omit<AnalysisRecord, "id" | "createdAt">) {
    if (!this.ownedJobIds(userId).has(a.jobId)) throw new Error("Job not found");
    const rec = { ...a, id: id("ana"), createdAt: new Date() };
    this.analyses.push(rec);
    return rec;
  }
  async latestAnalysis(userId: string, jobId: string) {
    return this.ownedJobIds(userId).has(jobId) ? latest(this.analyses.filter((a) => a.jobId === jobId)) : null;
  }

  async saveMatch(userId: string, m: Omit<MatchRecord, "id" | "createdAt">) {
    if (!this.ownedJobIds(userId).has(m.jobId)) throw new Error("Job not found");
    const rec = { ...m, id: id("mat"), createdAt: new Date() };
    this.matches.push(rec);
    return rec;
  }
  async latestMatch(userId: string, jobId: string) {
    return this.ownedJobIds(userId).has(jobId) ? latest(this.matches.filter((m) => m.jobId === jobId)) : null;
  }
  async saveAts(userId: string, m: Omit<AtsRecord, "id" | "createdAt">) {
    if (!this.ownedJobIds(userId).has(m.jobId)) throw new Error("Job not found");
    const rec = { ...m, id: id("ats"), createdAt: new Date() };
    this.atsReports.push(rec);
    return rec;
  }
  async latestAts(userId: string, jobId: string) {
    return this.ownedJobIds(userId).has(jobId) ? latest(this.atsReports.filter((m) => m.jobId === jobId)) : null;
  }

  async resumeForJob(userId: string, jobId: string | null) {
    return this.own(this.resumes, userId).find((r) => r.jobId === jobId) ?? null;
  }
  async listResumes(userId: string) {
    return this.own(this.resumes, userId).sort((a, b) => +b.updatedAt - +a.updatedAt);
  }
  async addResumeVersion(userId: string, jobId: string | null, v: Parameters<AppStore["addResumeVersion"]>[2]) {
    // No await between "find" and "create": two requests at once must not each create the document.
    let r = this.own(this.resumes, userId).find((x) => x.jobId === jobId) ?? null;
    const now = new Date();
    if (!r) {
      r = { id: id("res"), userId, jobId, name: v.name, versions: [], currentVersionId: "", createdAt: now, updatedAt: now };
      this.resumes.push(r);
    }
    const ver = { id: id("rv"), number: r.versions.length + 1, label: v.label, content: v.content, changeNotes: v.changeNotes, createdAt: now };
    r.versions.push(ver);
    r.currentVersionId = ver.id;
    r.updatedAt = now;
    return r;
  }
  async restoreResumeVersion(userId: string, resumeId: string, versionId: string) {
    const r = this.own(this.resumes, userId).find((x) => x.id === resumeId);
    const old = r?.versions.find((v) => v.id === versionId);
    if (!r || !old) throw new Error("Version not found");
    // Restore copies forward — history is never rewritten.
    return this.addResumeVersion(userId, r.jobId, {
      label: "USER_EDITED",
      content: structuredClone(old.content),
      changeNotes: [`Restored from version ${old.number}`],
      name: r.name,
    });
  }

  async coverLetterForJob(userId: string, jobId: string | null) {
    return this.own(this.letters, userId).find((r) => r.jobId === jobId) ?? null;
  }
  async listCoverLetters(userId: string) {
    return this.own(this.letters, userId).sort((a, b) => +b.updatedAt - +a.updatedAt);
  }
  async addCoverLetterVersion(userId: string, jobId: string | null, v: Parameters<AppStore["addCoverLetterVersion"]>[2]) {
    let r = this.own(this.letters, userId).find((x) => x.jobId === jobId) ?? null;
    const now = new Date();
    if (!r) {
      r = { id: id("cl"), userId, jobId, name: v.name, versions: [], currentVersionId: "", createdAt: now, updatedAt: now };
      this.letters.push(r);
    }
    const ver = { id: id("clv"), number: r.versions.length + 1, label: v.label, content: v.content, tone: v.tone, changeNotes: [], createdAt: now };
    r.versions.push(ver);
    r.currentVersionId = ver.id;
    r.updatedAt = now;
    return r;
  }
}
