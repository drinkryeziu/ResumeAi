import Link from "next/link";
import { Briefcase, ChevronRight, Coins, FileText, Gauge, Mail, PartyPopper, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { StatCard } from "@/components/ui/StatCard";
import { formatDate, formatNumber } from "@/lib/format";
import { profileStrength } from "@/server/ai";
import { requireProfile } from "@/server/auth/session";
import { jobSummaries, STATUS_LABEL } from "@/server/queries/jobs";
import { getStore } from "@/server/store";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { user, profile } = await requireProfile();
  const store = await getStore();
  const [balance, jobs, masterResume, masterLetter, prices] = await Promise.all([
    store.credits.balance(user.id),
    jobSummaries(store, user.id),
    store.resumeForJob(user.id, null),
    store.coverLetterForJob(user.id, null),
    store.credits.listPrices(),
  ]);
  const strength = profileStrength(profile);
  const price = (k: string) => prices.find((p) => p.key === k)?.credits ?? 0;
  const applicationCost = price("ANALYZE_JOB") + price("JOB_MATCH") + price("OPTIMIZE_RESUME") + price("GENERATE_COVER_LETTER");
  const ready = jobs.filter((j) => j.hasResume && j.hasLetter).length;
  const welcome = (await searchParams).welcome === "1";

  const masters = [
    { key: "resume", title: "Master Resume", icon: <FileText size={24} />, record: masterResume },
    { key: "cover-letter", title: "Master Cover Letter", icon: <Mail size={24} />, record: masterLetter },
  ] as const;

  return (
    <div className="flex flex-col gap-ds-5">
      {welcome && (
        <p role="status" className="flex items-center gap-ds-3 rounded-md bg-[#e7f5ef] p-ds-4 text-body text-success">
          <PartyPopper size={22} aria-hidden="true" />
          Your profile is saved and your Master Resume and Cover Letter are ready. Next, tailor them to a job.
        </p>
      )}
      <h1 className="text-heading-section">{welcome ? `Welcome, ${user.firstName}` : `Welcome back, ${user.firstName}`}</h1>

      {/* The page's one sand-300 moment, per the design system's PromoPanel rule. */}
      <section className="relative grid items-center gap-ds-5 overflow-hidden rounded-md bg-sky-50 p-ds-5 md:grid-cols-[1.4fr_1fr]">
        <div className="relative z-10 flex flex-col gap-ds-3">
          <h2 className="text-heading-section">Tailor your resume to a job</h2>
          <p className="text-body max-w-lg">Upload or paste a job description. We&apos;ll show your Job Match Score, then create a resume and cover letter tailored to that job.</p>
          <div className="flex flex-wrap items-center gap-ds-4">
            <ButtonLink href="/jobs/new" icon={<Briefcase size={14} aria-hidden="true" />}>
              Tailor resume to a job
            </ButtonLink>
            <span className="text-caption">About {applicationCost} credits per application</span>
          </div>
        </div>
        <div aria-hidden="true" className="relative hidden h-40 md:block">
          <div className="absolute top-4 -left-3 h-36 w-1/2 rounded-md bg-sand-300" />
          <div className="relative z-10 ml-6 flex h-36 flex-col justify-center gap-2 rounded-md bg-white p-ds-4 shadow-card">
            <span className="text-caption">Example job match</span>
            <span className="text-display-hero text-blue-600">86%</span>
            <span className="h-2 w-full rounded-pill bg-sky-50">
              <span className="block h-2 w-[86%] rounded-pill bg-blue-600" />
            </span>
          </div>
        </div>
      </section>

      <section aria-label="Your numbers" className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Profile strength" value={`${strength.score}%`} icon={<Gauge size={24} />} />
        <StatCard label="Jobs analyzed" value={jobs.length} icon={<Briefcase size={24} />} />
        <StatCard label="Applications ready" value={ready} icon={<FileText size={24} />} />
        <StatCard label="Available credits" value={formatNumber(balance)} icon={<Coins size={24} />} />
      </section>

      <div className="grid gap-ds-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Your applications" action={jobs.length > 0 ? <ButtonLink href="/jobs" variant="link">See all</ButtonLink> : undefined} />
          {jobs.length === 0 ? (
            <p className="text-body-sm">No applications yet. Add a job description to see how well you match.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-gray-100">
              {jobs.slice(0, 6).map(({ job, matchScore, hasResume, hasLetter }) => (
                <li key={job.id}>
                  <Link href={hasResume && hasLetter ? `/jobs/${job.id}` : `/jobs/${job.id}/match`} className="flex items-center gap-ds-3 py-ds-3 no-underline hover:text-blue-600">
                    <div className="flex flex-1 flex-col">
                      <span className="text-label-bold">
                        {job.title} — {job.company}
                      </span>
                      <span className="text-body-sm">{formatDate(job.updatedAt)}</span>
                    </div>
                    <Badge tone={job.status === "READY" ? "success" : "info"}>{STATUS_LABEL[job.status]}</Badge>
                    {matchScore !== null && <span className="w-24 text-right text-label-bold">Match {matchScore}%</span>}
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-ds-4">
          <Card>
            <CardHeader title="Your professional profile" subtitle="The source of truth for every resume and cover letter." />
            <ScoreBar label="Profile strength" value={strength.score} />
            {strength.nextSteps.length > 0 && (
              <ul className="mt-ds-3 flex list-disc flex-col gap-ds-1 pl-5 text-body-sm">
                {strength.nextSteps.slice(0, 3).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
            <div className="mt-ds-4 flex flex-wrap items-center gap-ds-4">
              <ButtonLink href="/profile/edit" variant="secondary" icon={<UserRound size={14} aria-hidden="true" />}>
                Update profile
              </ButtonLink>
              <ButtonLink href="/profile" variant="link">
                View profile
              </ButtonLink>
            </div>
          </Card>
          <Card>
            <CardHeader title="Master documents" subtitle="Built from your profile — the starting point for every application." />
            <ul className="flex flex-col gap-ds-3">
              {masters.map((m) => {
                const v = m.record?.versions.find((x) => x.id === m.record!.currentVersionId);
                return (
                  <li key={m.key} className="flex flex-col gap-ds-2 rounded-md bg-gray-100 p-ds-3">
                    <span className="flex items-center gap-ds-2 text-label-bold">
                      <span className="text-blue-600" aria-hidden="true">
                        {m.icon}
                      </span>
                      {m.title}
                      {v && <span className="text-caption font-normal">· V{v.number}, {formatDate(v.createdAt)}</span>}
                    </span>
                    {v ? (
                      <span className="flex gap-ds-4 text-body-sm">
                        <Link href={`/master?doc=${m.key}`} className="text-blue-700 underline">
                          Preview
                        </Link>
                        <Link href={`/master?doc=${m.key}&mode=edit`} className="text-blue-700 underline">
                          Edit
                        </Link>
                        <a href={`/api/jobs/master/download?doc=${m.key}&format=pdf`} className="text-blue-700 underline">
                          Download
                        </a>
                      </span>
                    ) : (
                      <Link href="/master" className="text-body-sm text-blue-700 underline">
                        Create it
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
