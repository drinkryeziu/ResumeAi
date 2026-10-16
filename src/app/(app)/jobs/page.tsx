import Link from "next/link";
import { Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate } from "@/lib/format";
import { requireProfile } from "@/server/auth/session";
import { jobSummaries, STATUS_LABEL } from "@/server/queries/jobs";
import { getStore } from "@/server/store";

export const metadata = { title: "Jobs" };

export default async function JobsPage() {
  const { user } = await requireProfile();
  const jobs = await jobSummaries(await getStore(), user.id);
  return (
    <>
      <PageHeader title="Jobs" description="Each job has its own workspace with a tailored resume, cover letter and match report." actions={<ButtonLink href="/jobs/new">Tailor resume to a job</ButtonLink>} />
      {jobs.length === 0 ? (
        <Card className="flex flex-col items-center gap-ds-3 py-ds-6 text-center">
          <Briefcase size={40} className="text-blue-600" aria-hidden="true" />
          <h2 className="text-card-title">No jobs yet</h2>
          <p className="text-body-sm max-w-sm">Paste a job description to see how well you match and get a tailored resume.</p>
        </Card>
      ) : (
        <ul className="grid gap-ds-4 md:grid-cols-2">
          {jobs.map(({ job, matchScore, atsScore, hasResume, hasLetter }) => (
            <li key={job.id}>
              <Link href={`/jobs/${job.id}`} className="flex h-full flex-col gap-ds-3 rounded-md bg-white p-ds-4 no-underline shadow-card hover:shadow-[0_0_0_2px_var(--blue-600)]">
                <div className="flex items-start justify-between gap-ds-3">
                  <div>
                    <h2 className="text-card-title text-blue-600">{job.title}</h2>
                    <p className="text-body-sm mt-ds-1">
                      {job.company}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                  </div>
                  <Badge tone={job.status === "READY" ? "success" : "info"}>{STATUS_LABEL[job.status]}</Badge>
                </div>
                <div className="flex flex-wrap gap-ds-4 text-body-sm">
                  <span>Job match: <strong>{matchScore === null ? "—" : `${matchScore}%`}</strong></span>
                  <span>ATS: <strong>{atsScore === null ? "—" : `${atsScore}%`}</strong></span>
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
