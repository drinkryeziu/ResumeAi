/**
 * Short confirmations shown as a toast after a page reload (a save that ends in a redirect adds `?notice=<key>`).
 * Only these exact keys are accepted, so a link can never make the site show text of someone else's choosing.
 */
export const NOTICES = {
  "job-analyzed": "Job analyzed. Your Job Match Score is ready.",
  "match-updated": "Match score updated.",
  "application-created": "Your resume and cover letter are ready.",
  "resume-improved": "Resume rewritten. It's saved as a new version.",
  "letter-rewritten": "Cover letter rewritten. It's saved as a new version.",
  "ats-checked": "ATS check finished.",
  "version-saved": "Saved as a new version. Earlier versions are kept.",
  "version-restored": "Version restored as a new version.",
  "masters-updated": "Master documents updated.",
  "application-deleted": "Application deleted.",
} as const;

export type NoticeKey = keyof typeof NOTICES;

/**
 * The value for `?notice=`: the key plus a short random tag. Two saves in a row then make two different addresses, so the
 * page always reacts to the second one (an identical address would look like "nothing changed").
 */
export const notice = (key: NoticeKey): string => `${key}.${Math.random().toString(36).slice(2, 7)}`;

/** The message for a `?notice=` value (with or without its tag), or null if it isn't one of ours. */
export const noticeMessage = (value: string | null | undefined): string | null => {
  const key = value?.split(".")[0];
  return key && Object.hasOwn(NOTICES, key) ? NOTICES[key as NoticeKey] : null;
};

/** The same address without `notice`, keeping every other parameter and any #hash. */
export function withoutNotice(pathname: string, search: string, hash = ""): string {
  const p = new URLSearchParams(search);
  p.delete("notice");
  const q = p.toString();
  return `${pathname}${q ? `?${q}` : ""}${hash}`;
}
