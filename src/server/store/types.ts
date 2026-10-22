import type { AtsAdvice, AtsScores, JobAnalysis, MatchReport, ProfileDraft, Tone } from "@/server/ai";
import type { AIRunStore } from "@/server/ai/runner";
import type { CreditService } from "@/server/credits/service";
import type { CoverLetterDocument, ResumeDocument } from "@/server/documents/model";
import type { ApprovedFactItem, JobInput, ProfileSnapshot } from "@/server/domain/profile";

export type JobStatus = "DRAFT" | "ANALYZED" | "MATCHED" | "OPTIMIZED" | "READY";
export type VersionLabel = "ORIGINAL" | "AI_OPTIMIZED" | "USER_EDITED" | "FINAL";

export interface CvImport {
  fileName: string;
  draft: ProfileDraft;
  createdAt: Date;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null; // null for Google / LinkedIn accounts
  createdAt: Date;
}

export interface JobRecord extends JobInput {
  userId: string;
  status: JobStatus;
  /** When the person said they applied for this job (they tick "Applied" on the Documents page). Only they set it; null or missing = not yet. */
  appliedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisRecord {
  id: string;
  jobId: string;
  result: JobAnalysis;
  promptVersion: string;
  aiRunId: string;
  createdAt: Date;
}

export interface MatchRecord {
  id: string;
  jobId: string;
  kind: "JOB_MATCH";
  overallScore: number;
  result: MatchReport;
  aiRunId: string;
  createdAt: Date;
}

export interface AtsRecord {
  id: string;
  jobId: string;
  kind: "ATS";
  resumeVersionId: string;
  overallScore: number;
  result: { scores: AtsScores; advice: AtsAdvice };
  aiRunId: string;
  createdAt: Date;
}

export interface Version<T> {
  id: string;
  number: number;
  label: VersionLabel;
  content: T;
  changeNotes: string[];
  createdAt: Date;
}

export interface ResumeRecord {
  id: string;
  userId: string;
  jobId: string | null;
  name: string;
  versions: Version<ResumeDocument>[];
  currentVersionId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoverLetterRecord {
  id: string;
  userId: string;
  jobId: string | null;
  name: string;
  versions: Array<Version<CoverLetterDocument> & { tone: Tone }>;
  currentVersionId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Persistence contract for the app. Every method is scoped by userId — there is no way to load
 * another user's record. MemoryAppStore implements it for the no-database mode; PrismaAppStore comes in phase 2.
 */
export interface AppStore {
  credits: CreditService;
  aiRuns: AIRunStore & { listForUser(userId: string): Promise<Array<{ workflow: string; costUsd: number; model: string; createdAt: Date }>> };

  createUser(u: { email: string; name: string; passwordHash: string | null }): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  getUser(userId: string): Promise<UserRecord | null>;

  /**
   * Password reset links. Only a hash of the token is stored. A user has at most one live link: creating a new one replaces the old.
   */
  createPasswordReset(userId: string, tokenHash: string, createdAt: Date, expiresAt: Date): Promise<void>;
  /**
   * Account deletion: removes the user and everything of theirs (profile, CV import, jobs and their reports, resumes and
   * cover letters with all versions, credit history, AI run log, reset links). Nothing is kept. Idempotent.
   */
  deleteAccount(userId: string): Promise<void>;

  /** When the user's latest reset link was made (used to throttle requests), or null. */
  lastPasswordResetAt(userId: string): Promise<Date | null>;
  /** The user a link belongs to, if it is still valid (not used, not expired). Does not use it up. */
  findPasswordReset(tokenHash: string, now: Date): Promise<{ userId: string } | null>;
  /** Uses the link up, once: returns its user, or null if it is unknown, expired or already used. */
  consumePasswordReset(tokenHash: string, now: Date): Promise<{ userId: string } | null>;
  /** Counts one hit for `key` in the current time window and returns how many hits the window has now. Windows expire by themselves. */
  hitRateLimit(key: string, windowMs: number, now: Date): Promise<number>;

  /** Replaces the user's password hash. Returns false if the user doesn't exist. */
  setPasswordHash(userId: string, passwordHash: string): Promise<boolean>;

  /** Throws if the user has no profile yet — use findProfile to check. */
  getProfile(userId: string): Promise<ProfileSnapshot>;
  findProfile(userId: string): Promise<ProfileSnapshot | null>;
  saveProfile(userId: string, profile: ProfileSnapshot): Promise<void>;
  /**
   * "Delete my profile": removes the profile (with its answers), a CV import waiting for review, and the Master Resume and
   * Master Cover Letter built from it. The account, credits and tailored applications stay. Idempotent.
   */
  deleteProfile(userId: string): Promise<void>;
  /** A parsed CV waiting for the user to review and save (REVIEW → EDIT → APPROVE → SAVE). */
  getCvImport(userId: string): Promise<CvImport | null>;
  setCvImport(userId: string, value: CvImport | null): Promise<void>;
  addApprovedFact(userId: string, fact: Omit<ApprovedFactItem, "id"> & { jobId: string }): Promise<ApprovedFactItem>;
  /** Corrects saved answers by id (their topic and question never change). Answers that are not there are skipped, others are left as they are. */
  updateApprovedFacts(userId: string, edits: Array<Pick<ApprovedFactItem, "id" | "status" | "answer">>): Promise<void>;

  createJob(userId: string, job: Omit<JobInput, "id">): Promise<JobRecord>;
  getJob(userId: string, jobId: string): Promise<JobRecord | null>;
  listJobs(userId: string): Promise<JobRecord[]>;
  setJobStatus(userId: string, jobId: string, status: JobStatus): Promise<void>;
  /** Marks the application as applied-for (now) or not. Does not touch `updatedAt`, so the list order stays. False when the job is not theirs or is gone. */
  setJobApplied(userId: string, jobId: string, applied: boolean, now?: Date): Promise<boolean>;
  /**
   * Deletes one application: the job, its analysis, match and ATS reports, and its tailored resume and cover letter
   * (every version). Never touches the profile, the Master documents, the credit ledger or the AI run log.
   * Returns false when the job doesn't exist or isn't the user's.
   */
  deleteJob(userId: string, jobId: string): Promise<boolean>;

  saveAnalysis(userId: string, a: Omit<AnalysisRecord, "id" | "createdAt">): Promise<AnalysisRecord>;
  latestAnalysis(userId: string, jobId: string): Promise<AnalysisRecord | null>;

  saveMatch(userId: string, m: Omit<MatchRecord, "id" | "createdAt">): Promise<MatchRecord>;
  latestMatch(userId: string, jobId: string): Promise<MatchRecord | null>;
  saveAts(userId: string, m: Omit<AtsRecord, "id" | "createdAt">): Promise<AtsRecord>;
  latestAts(userId: string, jobId: string): Promise<AtsRecord | null>;

  /** jobId null = the Master Resume (and below, the Master Cover Letter). */
  resumeForJob(userId: string, jobId: string | null): Promise<ResumeRecord | null>;
  listResumes(userId: string): Promise<ResumeRecord[]>;
  addResumeVersion(userId: string, jobId: string | null, v: { label: VersionLabel; content: ResumeDocument; changeNotes: string[]; name: string }): Promise<ResumeRecord>;
  restoreResumeVersion(userId: string, resumeId: string, versionId: string): Promise<ResumeRecord>;

  /** Deletes one resume with all its versions (a Master Resume or an application's resume). Never touches the job or anything else. False when it isn't the user's. */
  deleteResume(userId: string, resumeId: string): Promise<boolean>;
  /** Same for one cover letter. */
  deleteCoverLetter(userId: string, letterId: string): Promise<boolean>;

  coverLetterForJob(userId: string, jobId: string | null): Promise<CoverLetterRecord | null>;
  listCoverLetters(userId: string): Promise<CoverLetterRecord[]>;
  addCoverLetterVersion(userId: string, jobId: string | null, v: { label: VersionLabel; content: CoverLetterDocument; tone: Tone; name: string }): Promise<CoverLetterRecord>;
}
