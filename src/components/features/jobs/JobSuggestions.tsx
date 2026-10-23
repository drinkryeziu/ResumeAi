import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { jobSuggestionsFor } from "@/server/jobs/suggest";
import type { ProfileSnapshot } from "@/server/domain/profile";
import type { JobSuggestion } from "@/server/jobs/search";
import type { AppStore } from "@/server/store/types";

/**
 * "Jobs you could apply for": up to five real openings that fit the resume, each with its title, company and a link to the posting.
 * They come from a Google Jobs search made from the person's job title and city (see `server/jobs/search.ts`) and are listed exactly
 * as found. Postings can close, so the card says to check each one.
 */
export function JobSuggestionsList({ jobs, query }: { jobs: JobSuggestion[]; query: string }) {
  return (
    <Card aria-labelledby="jobs-h">
      <CardHeader
        title={<span id="jobs-h">Jobs you could apply for</span>}
        subtitle="Openings that fit your resume, found with Google Jobs. Postings can close, so check each one before you apply."
      />
      {jobs.length === 0 ? (
        <p className="text-body-sm">We couldn&apos;t find openings for “{query.replace(/ jobs( in .*)?$/, "")}” right now. Try again in a few days.</p>
      ) : (
        <ol className="flex flex-col gap-ds-2">
          {jobs.map((j) => (
            <li key={j.url} className="flex flex-wrap items-center justify-between gap-x-ds-4 gap-y-ds-2 rounded-md bg-gray-100 px-ds-3 py-ds-3">
              <div className="flex min-w-0 flex-1 basis-64 flex-col">
                <span className="text-label-bold">{j.title}</span>
                <span className="text-body-sm">
                  {j.company}
                  {j.location ? ` · ${j.location}` : ""}
                </span>
                {j.via && <span className="text-caption">Posted on {j.via}</span>}
              </div>
              <a
                href={j.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View the ${j.title} opening at ${j.company} (opens in a new tab)`}
                className="inline-flex items-center gap-1 text-body-sm text-blue-700 underline"
              >
                View the opening <ExternalLink size={14} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Looks up (or reuses) the suggestions and shows them; shows nothing at all when the feature is not set up or the search has nothing to say. */
export async function JobSuggestionsSection({ store, userId, profile }: { store: AppStore; userId: string; profile: Pick<ProfileSnapshot, "headline" | "city" | "state" | "country"> }): Promise<ReactNode> {
  const found = await jobSuggestionsFor(store, userId, profile);
  return found ? <JobSuggestionsList jobs={found.jobs} query={found.query} /> : null;
}

export function JobSuggestionsLoading() {
  return (
    <Card aria-busy="true" aria-live="polite">
      <p className="text-body-sm">Looking for openings that fit your resume…</p>
    </Card>
  );
}
