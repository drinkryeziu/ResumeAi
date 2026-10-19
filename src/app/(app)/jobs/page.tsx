import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ActionForm } from "@/components/features/job-flow/ActionForm";
import { JobInput } from "@/components/features/job-flow/JobInput";
import { StepProgress } from "@/components/features/job-flow/StepProgress";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SoftPanel } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate } from "@/lib/format";
import { requireProfile } from "@/server/auth/session";
import { DEMO_JOB } from "@/server/demo/fixtures";
import { jobSummaries, STATUS_LABEL } from "@/server/queries/jobs";
import { getStore } from "@/server/store";
import { analyzeNewJob } from "./actions";

export const metadata = { title: "Jobs" };

/** The Jobs tab opens on the add-a-job form so a description can be pasted straight away; saved jobs are listed below it. */
export default async function JobsPage({ searchParams }: { searchParams: Promise<{ sample?: string }> }) {
  const { user } = await requireProfile();
  const sample = (await searchParams).sample === "1" ? DEMO_JOB : null;
  const store = await getStore();
  const [jobs, analyzeCost, matchCost] = await Promise.all([jobSummaries(store, user.id), store.credits.priceOf("ANALYZE_JOB"), store.credits.priceOf("JOB_MATCH")]);
  const cost = analyzeCost + matchCost;
  return (
    <>
      <StepProgress current="add" completed={[]} />
      <PageHeader
        title="Tailor your resume to a job"
        description="Paste the job description. We'll compare it with your profile and Master Resume and show your Job Match Score."
        actions={
          !sample && (
            <ButtonLink href="/jobs?sample=1" variant="link">
              Try a sample job
            </ButtonLink>
          )
        }
      />
      <div className="mb-ds-6 grid gap-ds-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <ActionForm action={analyzeNewJob} hidden={{ requestId: crypto.randomUUID() }} label="Analyze job" pendingLabel="Analyzing the job…" cost={cost}>
            <div className="mb-ds-5 flex flex-col gap-ds-4">
              <JobInput defaultText={sample?.description} />
              <Field label="Link to the job posting" htmlFor="url">
                <Input id="url" name="url" type="url" placeholder="https://" defaultValue={sample?.url} />
              </Field>
              <div className="grid gap-ds-4 md:grid-cols-2">
                <Field label="Job title" htmlFor="title">
                  <Input id="title" name="title" placeholder="Senior UX Designer" defaultValue={sample?.title} />
                </Field>
                <Field label="Company name" htmlFor="company">
                  <Input id="company" name="company" placeholder="Company" defaultValue={sample?.company} />
                </Field>
                <Field label="Location" htmlFor="location">
                  <Input id="location" name="location" placeholder="City, remote or hybrid" defaultValue={sample?.location} />
                </Field>
              </div>
            </div>
          </ActionForm>
        </Card>
        <SoftPanel className="flex h-fit flex-col gap-ds-3">
          <ShieldCheck size={32} className="text-blue-600" aria-hidden="true" />
          <h2 className="text-heading-feature">Only what&apos;s true about you</h2>
          <p className="text-body-sm">
            We never add experience, skills, education or results you haven&apos;t given us. If the job asks for something we can&apos;t find, we&apos;ll show it as missing — and
            you can tell us if you have it.
          </p>
        </SoftPanel>
      </div>

      <h2 className="text-card-title mb-ds-3">Your jobs</h2>
      {jobs.length === 0 ? (
        <p className="text-body-sm">Jobs you add appear here, each with its own tailored resume, cover letter and match report.</p>
      ) : (
        <ul className="grid gap-ds-4 md:grid-cols-2">
          {jobs.map(({ job, matchScore, atsScore, hasResume, hasLetter }) => (
            <li key={job.id}>
              <Link href={`/jobs/${job.id}`} className="flex h-full flex-col gap-ds-3 rounded-md bg-white p-ds-4 no-underline shadow-card hover:shadow-[0_0_0_2px_var(--blue-600)]">
                <div className="flex items-start justify-between gap-ds-3">
                  <div>
                    <h3 className="text-card-title text-blue-600">{job.title}</h3>
                    <p className="text-body-sm mt-ds-1">
                      {job.company}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                  </div>
                  <Badge tone={job.status === "READY" ? "success" : "info"}>{STATUS_LABEL[job.status]}</Badge>
                </div>
                <div className="flex flex-wrap gap-ds-4 text-body-sm">
                  <span>
                    Job match: <strong>{matchScore === null ? "—" : `${matchScore}%`}</strong>
                  </span>
                  <span>
                    ATS: <strong>{atsScore === null ? "—" : `${atsScore}%`}</strong>
                  </span>
                  <span>Resume {hasResume ? "✓" : "—"}</span>
                  <span>Cover letter {hasLetter ? "✓" : "—"}</span>
                </div>
                <span className="text-caption">Updated {formatDate(job.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
