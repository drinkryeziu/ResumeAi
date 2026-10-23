/**
 * The error log on the admin dashboard: what went wrong for people, grouped so the same problem shows up once with a count.
 * Pure rules here; the stores keep the rows. Messages never hold personal data: emails, links and long numbers are masked
 * and nothing from a CV, profile or document is ever stored.
 */
export interface ErrorEntry {
  id: string;
  at: Date;
  /** Where it happened, e.g. "cv_upload" or "create_application". */
  source: string;
  /** What kind of problem, e.g. "scanned" or "ai_busy". Errors with the same source and code are one problem. */
  code: string;
  message: string;
  /** Who ran into it; null when they were signed out or it isn't known. */
  userId: string | null;
  /** The page, without its query string. */
  path?: string;
}
export type ErrorInput = Omit<ErrorEntry, "id">;

/** Plain names for the places errors come from. Unknown ones are shown as written. */
export const SOURCE_LABELS: Record<string, string> = {
  cv_upload: "CV upload",
  analyze_job: "Analyze a job",
  check_match: "Job match",
  create_application: "Create an application",
  improve_resume: "Improve a resume",
  ats_check: "ATS check",
  rewrite_cover_letter: "Cover letter rewrite",
  answer_question: "Answering a question",
  save_resume: "Saving a resume",
  save_cover_letter: "Saving a cover letter",
  master_documents: "Master documents",
  save_profile: "Saving the profile",
  job_suggestions: "Job suggestions",
  page: "A page in the browser",
};
export const sourceLabel = (s: string) => SOURCE_LABELS[s] ?? s;

/** Keeps a message useful for fixing the problem and free of anything that identifies a person. */
export function cleanMessage(s: string, max = 300): string {
  return s
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]")
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** The page path only: no query string or fragment, which can carry tokens (a password reset link) or names. */
export const cleanPath = (p: string | undefined) => (p ? p.split(/[?#]/)[0]!.slice(0, 200) : undefined);

export interface ErrorGroup {
  source: string;
  code: string;
  /** The latest message of the group. */
  message: string;
  count: number;
  /** How many different people hit it (signed-out hits are not counted). */
  people: number;
  firstAt: Date;
  lastAt: Date;
}

/** One row per problem, the most recent first. */
export function groupErrors(entries: readonly ErrorEntry[]): ErrorGroup[] {
  const map = new Map<string, ErrorGroup & { who: Set<string> }>();
  for (const e of [...entries].sort((a, b) => +new Date(b.at) - +new Date(a.at))) {
    const key = `${e.source}\u0000${e.code}`;
    const g = map.get(key);
    const at = new Date(e.at);
    if (!g) map.set(key, { source: e.source, code: e.code, message: e.message, count: 1, people: 0, firstAt: at, lastAt: at, who: new Set(e.userId ? [e.userId] : []) });
    else {
      g.count++;
      if (+at < +g.firstAt) g.firstAt = at;
      if (e.userId) g.who.add(e.userId);
    }
  }
  return [...map.values()]
    .map(({ who, ...g }) => ({ ...g, people: who.size }))
    .sort((a, b) => +b.lastAt - +a.lastAt);
}

export interface ErrorSummary {
  /** How many errors in the window (can be more than `entries`). */
  total: number;
  /** The newest ones, at most the limit asked for. */
  entries: ErrorEntry[];
}
