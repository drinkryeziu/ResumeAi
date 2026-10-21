/**
 * Turns what a person typed for a professional link into a full web address, without guessing at anything else.
 *   "linkedin.com/in/alex"   → "https://www.linkedin.com/in/alex"   (LinkedIn's own address form)
 *   "github.com/alex"        → "https://github.com/alex"
 *   "alex.dev/work?x=1#top"  → "https://alex.dev/work?x=1#top"      (host, path, query and case kept as typed)
 * `www.` is added only for LinkedIn, whose canonical address uses it; elsewhere the host is kept as typed, because a bare
 * domain does not always answer on www. Anything that does not look like a web address is returned unchanged, so the form
 * can say what is wrong instead of the app guessing.
 */
export function normalizeUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  if (/\s/.test(raw)) return raw;

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  if (hasScheme && !/^https?:\/\//i.test(raw)) return raw; // ftp://, javascript: and the like are not ours to fix
  const withScheme = hasScheme ? raw : `https://${raw.replace(/^\/\//, "")}`;

  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return raw;
  }
  if (!u.hostname.includes(".") || u.hostname.startsWith(".") || u.hostname.endsWith(".")) return raw;

  if (/^(?:[a-z]{2,3}\.)?linkedin\.com$/i.test(u.hostname) && !u.hostname.startsWith("www.")) u.hostname = u.hostname.replace(/^(?:[a-z]{2,3}\.)?/i, "www.");

  // Keep the person's own path as written; only drop the lone "/" that URL adds to a bare host.
  const out = u.toString();
  return u.pathname === "/" && !u.search && !u.hash && !/\/$/.test(raw) ? out.replace(/\/$/, "") : out;
}
