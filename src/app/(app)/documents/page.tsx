import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppliedCheckbox } from "@/components/features/documents/AppliedCheckbox";
import { DeleteDocumentButton } from "@/components/features/documents/DeleteDocumentButton";
import { DocumentRow } from "@/components/features/documents/DocumentRow";
import { requireProfile } from "@/server/auth/session";
import { getStore } from "@/server/store";

export const metadata = { title: "Documents" };

/** A row's worth of empty state: what is missing and the one way to make it. */
function MissingRow({ children, href, action }: { children: React.ReactNode; href: string; action: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-ds-3 rounded-md bg-gray-100 px-ds-3 py-ds-3 text-body-sm">
      <span>{children}</span>
      <ButtonLink href={href} variant="secondary" compact>
        {action}
      </ButtonLink>
    </li>
  );
}

const dl = (target: string, doc: "resume" | "cover-letter") => `/api/jobs/${target}/download?doc=${doc}`;

/** Every document you created for a job, in one place: each application's resume and cover letter, grouped by company. */
export default async function DocumentsPage() {
  const { user } = await requireProfile();
  const store = await getStore();
  const [resumes, letters, jobs] = await Promise.all([store.listResumes(user.id), store.listCoverLetters(user.id), store.listJobs(user.id)]);

  // One group per application that has at least one document, the most recently changed first.
  const groups = jobs
    .map((job) => {
      const resume = resumes.find((r) => r.jobId === job.id) ?? null;
      const letter = letters.find((l) => l.jobId === job.id) ?? null;
      const touched = Math.max(+(resume?.updatedAt ?? 0), +(letter?.updatedAt ?? 0));
      return { job, resume, letter, touched };
    })
    .filter((g) => g.resume || g.letter)
    .sort((a, b) => b.touched - a.touched);

  return (
    <>
      <PageHeader
        title="Documents"
        description="Every resume and cover letter you created for a job. Edit, download or delete any of them."
      />
      <div className="flex flex-col gap-ds-6">
        <section aria-labelledby="apps-h" className="flex flex-col gap-ds-4">
          <div>
            <h2 id="apps-h" className="text-heading-section">
              Applications
            </h2>
            <p className="text-body-sm">The resume and cover letter you created for each job, grouped by company.</p>
          </div>
          {groups.length === 0 ? (
            <Card>
              <ul>
                <MissingRow href="/dashboard#tailor" action="Tailor to a job">
                  Resumes and cover letters you create for a job appear here.
                </MissingRow>
              </ul>
            </Card>
          ) : (
            groups.map(({ job, resume, letter }) => (
              <Card key={job.id} role="group" aria-labelledby={`co-${job.id}`} className="flex flex-col gap-ds-3">
                <div className="flex items-start justify-between gap-ds-4">
                  <div className="min-w-0">
                    <h3 id={`co-${job.id}`} className="text-card-title">
                      {job.company}
                    </h3>
                    <p className="text-body-sm">{job.title}</p>
                  </div>
                  <AppliedCheckbox jobId={job.id} company={job.company} appliedAt={job.appliedAt ? new Date(job.appliedAt).toISOString() : null} />
                </div>
                <ul className="flex flex-col gap-ds-2">
                  {resume && (
                    <DocumentRow
                      title="Resume"
                      kind="resume"
                      kindLabel={`${job.company} resume`}
                      versions={resume.versions}
                      currentVersionId={resume.currentVersionId}
                      viewHref={`/jobs/${job.id}?doc=resume&from=documents`}
                      editHref={`/jobs/${job.id}?doc=resume&mode=edit&from=documents`}
                      downloadBase={dl(job.id, "resume")}
                      deleteButton={
                        <DeleteDocumentButton
                          kind="resume"
                          id={resume.id}
                          label={`${job.company} resume`}
                          consequence="The application stays, so you can create the resume again from its match page."
                        />
                      }
                    />
                  )}
                  {letter && (
                    <DocumentRow
                      title="Cover letter"
                      kind="cover-letter"
                      kindLabel={`${job.company} cover letter`}
                      versions={letter.versions}
                      currentVersionId={letter.currentVersionId}
                      viewHref={`/jobs/${job.id}?doc=cover-letter&from=documents`}
                      editHref={`/jobs/${job.id}?doc=cover-letter&mode=edit&from=documents`}
                      downloadBase={dl(job.id, "cover-letter")}
                      deleteButton={
                        <DeleteDocumentButton
                          kind="cover-letter"
                          id={letter.id}
                          label={`${job.company} cover letter`}
                          consequence="The application stays, so you can write the cover letter again."
                        />
                      }
                    />
                  )}
                </ul>
              </Card>
            ))
          )}
        </section>
      </div>
    </>
  );
}
