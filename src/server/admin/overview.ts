/**
 * What the admin dashboard shows, worked out from plain rows. Pure functions: the stores only fetch rows, and every rule
 * (what counts as an application, who is active, how bad a day looks) lives here where tests can reach it.
 */

/** A person who did anything in this many days counts as active. */
export const ACTIVE_DAYS = 30;
const DAY = 86_400_000;

/** Raw rows for the overview. `documents` are tailored resumes and cover letters only (not the Master documents). */
export interface AdminSnapshot {
  users: Array<{ id: string; name: string; email: string; createdAt: Date }>;
  profileUserIds: string[];
  jobs: Array<{ id: string; userId: string; appliedAt: Date | null; updatedAt: Date }>;
  documents: Array<{ userId: string; jobId: string; updatedAt: Date }>;
  matches: Array<{ userId: string; jobId: string; overallScore: number; createdAt: Date }>;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  hasProfile: boolean;
  /** Jobs that have a tailored resume or cover letter. */
  applications: number;
  /** Of those, the ones the person ticked "Applied" on. */
  applied: number;
  /** Mean Job Match Score of those applications (each one's latest score), whole number; null when none has a score. */
  averageScore: number | null;
  lastActiveAt: Date;
  active: boolean;
}

export function buildUserRows(s: AdminSnapshot, now = new Date()): UserRow[] {
  const profiles = new Set(s.profileUserIds);
  const appJobs = new Map<string, Set<string>>(); // userId -> jobs with a tailored document
  const touched = new Map<string, number>(); // userId -> latest activity
  const bump = (userId: string, at: Date) => touched.set(userId, Math.max(touched.get(userId) ?? 0, +new Date(at)));
  for (const d of s.documents) {
    (appJobs.get(d.userId) ?? appJobs.set(d.userId, new Set()).get(d.userId)!).add(d.jobId);
    bump(d.userId, d.updatedAt);
  }
  for (const j of s.jobs) bump(j.userId, j.updatedAt);
  // Latest score per job.
  const latest = new Map<string, { at: number; score: number }>();
  for (const m of s.matches) {
    const key = `${m.userId}:${m.jobId}`;
    const prev = latest.get(key);
    if (!prev || +new Date(m.createdAt) >= prev.at) latest.set(key, { at: +new Date(m.createdAt), score: m.overallScore });
    bump(m.userId, m.createdAt);
  }
  const appliedJobs = new Set(s.jobs.filter((j) => j.appliedAt).map((j) => `${j.userId}:${j.id}`));

  return s.users
    .map((u) => {
      const jobs = [...(appJobs.get(u.id) ?? [])];
      const scores = jobs.flatMap((id) => (latest.has(`${u.id}:${id}`) ? [latest.get(`${u.id}:${id}`)!.score] : []));
      const lastActiveAt = new Date(Math.max(+new Date(u.createdAt), touched.get(u.id) ?? 0));
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        hasProfile: profiles.has(u.id),
        applications: jobs.length,
        applied: jobs.filter((id) => appliedJobs.has(`${u.id}:${id}`)).length,
        averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        lastActiveAt,
        active: +now - +lastActiveAt <= ACTIVE_DAYS * DAY,
      };
    })
    .sort((a, b) => +b.lastActiveAt - +a.lastActiveAt);
}

export interface UsageTotals {
  users: number;
  active: number;
  applications: number;
  applied: number;
  /** Mean of the people's averages weighted by applications, i.e. the mean over all applications that have a score. */
  averageScore: number | null;
}

export function totalsOf(rows: UserRow[]): UsageTotals {
  const scored = rows.filter((r) => r.averageScore !== null);
  const weight = scored.reduce((a, r) => a + r.applications, 0);
  return {
    users: rows.length,
    active: rows.filter((r) => r.active).length,
    applications: rows.reduce((a, r) => a + r.applications, 0),
    applied: rows.reduce((a, r) => a + r.applied, 0),
    averageScore: weight ? Math.round(scored.reduce((a, r) => a + r.averageScore! * r.applications, 0) / weight) : null,
  };
}

// ───────────── security and AI health ─────────────

export type SecurityEventType = "sign_in_failed" | "rate_limited" | "account_removed";
export interface SecurityEvent {
  type: SecurityEventType;
  /** Which limit was hit (for rate_limited), e.g. "signin-ip". Never an address, email or name. */
  rule?: string;
  at: Date;
}
export interface SecuritySummary {
  counts: Record<SecurityEventType, number>;
  recent: SecurityEvent[];
}

/** What each limit protects, in plain words, for the list of events. */
export const RULE_LABELS: Record<string, string> = {
  "signin-ip": "sign-in from one address",
  "signin-email": "sign-in to one account",
  "signup-ip": "sign-ups from one address",
  "reset-ip": "password reset requests",
  "reset-done-ip": "password reset links",
  "export-user": "data export",
  "delete-user": "account deletion",
  "ai-user": "AI actions",
  "admin-user": "admin changes",
};

export type Level = "normal" | "elevated" | "high";

/** How the last 24 hours look: a handful of wrong passwords is normal; floods are not. */
export function threatLevel(c: Pick<SecuritySummary["counts"], "sign_in_failed" | "rate_limited">): Level {
  if (c.sign_in_failed >= 50 || c.rate_limited >= 20) return "high";
  if (c.sign_in_failed >= 15 || c.rate_limited >= 5) return "elevated";
  return "normal";
}

export type AiHealth = "healthy" | "degraded" | "idle";
/** Runs that failed or were turned down by the checks. Idle when nothing ran. */
export function aiHealth(stats: { total: number; failed: number }): AiHealth {
  if (stats.total === 0) return "idle";
  return stats.failed / stats.total >= 0.3 ? "degraded" : "healthy";
}
