/**
 * "Jobs you could apply for": real openings found with Google Jobs, shown after the Master documents are created.
 * Google has no official job-search API, so the search goes through SerpApi (https://serpapi.com), which returns what Google Jobs shows.
 *
 * Only the person's job title and city and state are sent. The openings are listed exactly as the search returned them: this code
 * never writes, rewords or adds a job or a link, and a result without a company, a title or an https link is dropped.
 */
export interface JobSuggestion {
  title: string;
  company: string;
  location: string;
  /** Where to apply or read the posting: always https. */
  url: string;
  /** The site the posting is on, like "LinkedIn". */
  via: string;
}

export class JobSearchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "JobSearchError";
  }
}

/** The job title for the search: the profile's own title, without any list of extra keywords after a "·", "|" or comma. */
export function titleForSearch(headline: string | null | undefined): string {
  const first = (headline ?? "").split(/\s*[·|•,;]\s*|\s+[-–—/]\s+/)[0] ?? "";
  return first.replace(/\s+/g, " ").trim().slice(0, 80);
}

/** What to ask Google Jobs: "Senior Product Designer jobs in Cornelius, NC". Null without a job title (nothing sensible to search for). */
export function queryFor(p: { headline?: string | null; city?: string | null; state?: string | null; country?: string | null }): string | null {
  const title = titleForSearch(p.headline);
  if (!title) return null;
  const place = [p.city, p.state].filter(Boolean).join(", ") || p.country || "";
  return place ? `${title} jobs in ${place}` : `${title} jobs`;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const httpsUrl = (v: unknown) => {
  if (typeof v !== "string") return "";
  try {
    const u = new URL(v);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : "";
  } catch {
    return "";
  }
};

/** Reads SerpApi's Google Jobs answer into at most `limit` openings, dropping anything incomplete and repeats. */
export function parseGoogleJobs(json: unknown, limit = 5): JobSuggestion[] {
  const rows = (json as { jobs_results?: unknown } | null)?.jobs_results;
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const out: JobSuggestion[] = [];
  for (const r of rows as Array<Record<string, unknown>>) {
    const title = text(r.title, 160);
    const company = text(r.company_name, 120);
    const options = Array.isArray(r.apply_options) ? (r.apply_options as Array<Record<string, unknown>>) : [];
    const url = options.map((o) => httpsUrl(o.link)).find(Boolean) || httpsUrl(r.share_link);
    if (!title || !company || !url) continue;
    const key = `${company}\u0000${title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, company, location: text(r.location, 120), url, via: text(r.via, 60).replace(/^via\s+/i, "") });
    if (out.length === limit) break;
  }
  return out;
}

/** One search. Throws JobSearchError when the service says no or can't be reached; an empty list means Google had nothing. */
export async function searchJobs(query: string, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<JobSuggestion[]> {
  const url = `https://serpapi.com/search.json?${new URLSearchParams({ engine: "google_jobs", q: query, hl: "en", api_key: apiKey })}`;
  let res: Response;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(9000), headers: { Accept: "application/json" } });
  } catch (e) {
    throw new JobSearchError(`The job search could not be reached (${(e as Error).name}).`);
  }
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  // "Google hasn't returned any results" arrives as an error text, not as a failure.
  if (json?.error && /hasn't returned any results|no results/i.test(json.error)) return [];
  if (!res.ok || json?.error) throw new JobSearchError(`The job search answered with an error (${res.status}).`, res.status);
  return parseGoogleJobs(json);
}
