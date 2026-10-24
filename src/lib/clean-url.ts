/**
 * The "Link to the job posting" is optional and only a convenience, so it must never stop anyone. People paste "linkedin.com/jobs/1"
 * or "www.example.com/job" without "https://"; that gets the scheme added, and anything that still isn't a web address is dropped
 * (an empty link) instead of being an error.
 */
export function cleanJobUrl(raw: unknown): string {
  const text = String(raw ?? "").trim();
  if (!text || /^(mailto|javascript|tel|sms|data|file|ftp|blob):/i.test(text)) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".")) return "";
    return withScheme.slice(0, 2000);
  } catch {
    return "";
  }
}
