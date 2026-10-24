import Link from "next/link";
import { ArrowRight, ClipboardPaste, FileCheck2, Target } from "lucide-react";
import { DeleteApplicationButton } from "@/components/features/job-flow/DeleteApplicationButton";
import { Badge } from "@/components/ui/Badge";
import { NewJobCard } from "@/components/features/job-flow/NewJobCard";
import { JobDirectionsCard } from "@/components/features/match/JobDirectionsCard";
import { ButtonLink } from "@/components/ui/Button";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { formatDate, formatNumber } from "@/lib/format";
import { profileStrength } from "@/server/ai";
import { requireProfile } from "@/server/auth/session";
import { jobSummaries, STATUS_LABEL } from "@/server/queries/jobs";
import { getStore } from "@/server/store";

export const metadata = { title: "Dashboard" };

type Summary = Awaited<ReturnType<typeof jobSummaries>>[number];

/** An application that has a match but no resume and cover letter yet: the one thing worth finishing first. */
function unfinishedStep(jobs: Summary[]): { title: string; detail: string; href: string } | null {
  const unfinished = jobs.find((j) => j.matchScore !== null && !(j.hasResume && j.hasLetter));
  if (!unfinished) return null;
  return {
    title: `Finish your application for ${unfinished.job.title}`,
    detail: `${unfinished.job.company} — you match ${unfinished.matchScore}%. Create your tailored resume and cover letter.`,
    href: `/jobs/${unfinished.job.id}/match`,
  };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { user, profile } = await requireProfile();
  const store = await getStore();
  const [balance, jobs, masterResume, prices] = await Promise.all([
    store.credits.balance(user.id),
    jobSummaries(store, user.id),
    store.resumeForJob(user.id, null),
    store.credits.listPrices(),
  ]);
  const strength = profileStrength(profile);
  const price = (k: string) => prices.find((p) => p.key === k)?.credits ?? 0;
  const applicationCost = price("ANALYZE_JOB") + price("JOB_MATCH") + price("OPTIMIZE_RESUME") + price("GENERATE_COVER_LETTER");
  const sp = await searchParams;
  const welcome = sp.welcome === "1";
  const finish = unfinishedStep(jobs);
  const tailorCost = price("ANALYZE_JOB") + price("JOB_MATCH");
  const applicationsLeft = applicationCost ? Math.floor(balance / applicationCost) : 0;

  return (
    <div className="flex flex-col gap-ds-5">
      <header className="flex flex-col gap-ds-1">
        <h1 className="text-heading-section">{welcome ? `Welcome, ${user.firstName}` : `Welcome back, ${user.firstName}`}</h1>
        <p className="text-body">
          {welcome
            ? "Your profile is saved. Add a job below to see how well you match."
            : `You have ${formatNumber(balance)} credits — enough for about ${applicationsLeft} more ${applicationsLeft === 1 ? "application" : "applications"}.`}
        </p>
      </header>

      {finish && (
        <section aria-labelledby="next-step" className="flex flex-col gap-ds-4 rounded-md bg-sky-50 p-ds-5">
          <div className="flex max-w-xl flex-col gap-ds-1">
            <h2 id="next-step" className="text-card-title">
              {finish.title}
            </h2>
            <p className="text-body-sm">{finish.detail}</p>
          </div>
          <ButtonLink href={finish.href} variant="secondary" className="w-full">
            Continue
          </ButtonLink>
        </section>
      )}

      <NewJobCard cost={tailorCost} />

      <JobDirectionsCard analysis={masterResume?.versions.find((v) => v.id === masterResume.currentVersionId)?.content.analysis} />

      <div className="grid items-start gap-ds-5">
        <section aria-labelledby="applications">
          <div className="mb-ds-3 flex items-baseline justify-between">
            <h2 id="applications" className="text-card-title">
              Your applications
            </h2>
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-md bg-white p-ds-5 shadow-card">
              <p className="text-body mb-ds-4">Each job you add gets its own tailored resume and cover letter. Here&apos;s how it goes:</p>
              <ol className="flex flex-col gap-ds-4">
                {[
                  { icon: <ClipboardPaste size={22} />, t: "Add a job", d: "Paste the description or upload it as a file." },
                  { icon: <Target size={22} />, t: "See your match", d: `Your Job Match Score, matching skills and gaps (${price("ANALYZE_JOB") + price("JOB_MATCH")} credits).` },
                  {
                    icon: <FileCheck2 size={22} />,
                    t: "Create your application",
                    d: `A tailored resume and cover letter, ready to download (${price("OPTIMIZE_RESUME") + price("GENERATE_COVER_LETTER")} credits).`,
                  },
                ].map((s, i) => (
                  <li key={s.t} className="flex gap-ds-3">
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-50 text-blue-600">
                      {s.icon}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-heading-feature">
                        {i + 1}. {s.t}
                      </span>
                      <span className="text-body-sm">{s.d}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-md bg-white shadow-card">
              {jobs.slice(0, 8).map(({ job, matchScore, hasResume, hasLetter }) => {
                const ready = hasResume && hasLetter;
                return (
                  <li key={job.id} className="flex items-center hover:bg-sky-50">
                    <Link
                      href={ready ? `/jobs/${job.id}` : `/jobs/${job.id}/match`}
                      className="group grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-ds-4 gap-y-ds-1 py-ds-3 pr-ds-2 pl-ds-4 no-underline sm:grid-cols-[1fr_auto_64px_16px]"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-label-bold group-hover:text-blue-700">{job.title}</span>
                        <span className="truncate text-body-sm">
                          {job.company}
                          <span className="hidden sm:inline">, {formatDate(job.updatedAt)}</span>
                          {matchScore !== null && <span className="sm:hidden">, {matchScore}% match</span>}
                        </span>
                      </span>
                      <Badge tone={ready ? "success" : "info"}>{STATUS_LABEL[job.status]}</Badge>
                      <span className="hidden text-right sm:block">
                        {matchScore !== null && (
                          <>
                            <span className="text-label-bold">{matchScore}%</span>
                            <span className="sr-only"> job match</span>
                          </>
                        )}
                      </span>
                      <ArrowRight size={16} aria-hidden="true" className="hidden text-blue-600 sm:block" />
                    </Link>
                    <div className="pr-ds-2 pl-ds-1">
                      <DeleteApplicationButton jobId={job.id} title={job.title} company={job.company} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="profile-h" className="flex flex-col rounded-md bg-white p-ds-4 shadow-card">
        <div className="mb-ds-3 flex items-baseline justify-between">
          <h2 id="profile-h" className="text-card-title">
            Your profile
          </h2>
          <Link href="/profile" className="text-body-sm text-blue-700 underline">
            View
          </Link>
        </div>
        <ScoreBar label="Complete" value={strength.score} />
        {strength.nextSteps.length > 0 && (
          <ul className="mt-ds-3 flex list-disc flex-col gap-ds-1 pl-5 text-body-sm">
            {strength.nextSteps.slice(0, 3).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
