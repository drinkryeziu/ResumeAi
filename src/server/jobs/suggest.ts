import { recordError } from "@/server/admin/record-error";
import { overLimit, RULES } from "@/server/security/rate-limit";
import type { ProfileSnapshot } from "@/server/domain/profile";
import type { AppStore, StoredJobSuggestions } from "@/server/store/types";
import { JobSearchError, queryFor, searchJobs } from "./search";

/** The same openings are shown again for this long before the search is made again. */
export const SUGGESTIONS_FRESH_DAYS = 7;

/** Turned on by adding SERPAPI_API_KEY. Without it the page simply has no "Jobs you could apply for" card. */
export const jobSearchConfigured = () => Boolean(process.env.SERPAPI_API_KEY?.trim());

/**
 * The openings for this person's resume: found once with Google Jobs from their job title and city, kept, and shown from then on.
 * It never blocks or breaks the page: any problem is noted in the admin error log and the page just shows what it has (or nothing).
 */
export async function jobSuggestionsFor(
  store: AppStore,
  userId: string,
  profile: Pick<ProfileSnapshot, "headline" | "city" | "state" | "country">,
  opts: { now?: Date; fetchImpl?: typeof fetch } = {},
): Promise<StoredJobSuggestions | null> {
  const key = process.env.SERPAPI_API_KEY?.trim();
  if (!key) return null;
  const query = queryFor(profile);
  if (!query) return null;
  const now = opts.now ?? new Date();
  const cached = await store.getJobSuggestions(userId);
  const fresh = cached && cached.query === query && +now - +new Date(cached.createdAt) < SUGGESTIONS_FRESH_DAYS * 86_400_000;
  if (fresh) return cached;
  if (await overLimit(store, RULES.jobSearchUser, userId, now)) return cached;
  try {
    const jobs = await searchJobs(query, key, opts.fetchImpl);
    const value: StoredJobSuggestions = { query, createdAt: now, jobs };
    await store.saveJobSuggestions(userId, value);
    return value;
  } catch (e) {
    await recordError(store, {
      source: "job_suggestions",
      code: e instanceof JobSearchError && e.status ? `search_${e.status}` : "search_failed",
      message: e instanceof Error ? e.message : "The job search failed.",
      userId,
    });
    return cached;
  }
}
