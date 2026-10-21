import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteDocumentButton } from "@/components/features/documents/DeleteDocumentButton";
import { DocumentRow } from "@/components/features/documents/DocumentRow";
import { ViewWindow } from "@/components/features/documents/ViewWindow";
import { CoverLetterPreview, ResumePreview } from "@/components/features/documents/ResumePreview";
import { formatDate } from "@/lib/format";
import { requireProfile } from "@/server/auth/session";
import { getStore } from "@/server/store";

export const metadata = { title: "Documents" };

/** A row's worth of empty state: what is missing and the one way to make it. */
function MissingRow({ children, href, action }: { children: React.ReactNode; href: string; action: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-ds-3 rounded-md bg-sky-50 px-ds-4 py-ds-3 text-body-sm">
      <span>{children}</span>
      <ButtonLink href={href} variant="secondary" compact>
        {action}
      </ButtonLink>
    </li>
  );
}

const dl = (target: string, doc: "resume" | "cover-letter") => `/api/jobs/${target}/download?doc=${doc}`;

/** Every document in one place: the Master documents first, then each application's resume and cover letter, grouped by company. */
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const { user } = await requireProfile();
  const store = await getStore();
  const [resumes, letters, jobs] = await Promise.all([store.listResumes(user.id), store.listCoverLetters(user.id), store.listJobs(user.id)]);

  const masterResume = resumes.find((r) => r.jobId === null) ?? null;
  const masterLetter = letters.find((l) => l.jobId === null) ?? null;

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

  // The document opened for reading (?view=<id>): its current version, shown in a window with Edit and Close.
  const currentOf = <V extends { id: string }>(versions: V[], id: string) => versions.find((v) => v.id === id) ?? versions.at(-1)!;
  const jobName = (jobId: string | null) => jobs.find((j) => j.id === jobId)?.company;
  const openResume = view ? resumes.find((r) => r.id === view) : undefined;
  const openLetter = !openResume && view ? letters.find((l) => l.id === view) : undefined;
  const opened = openResume
    ? { title: openResume.jobId ? `${jobName(openResume.jobId) ?? "Application"} resume` : "Master Resume", v: currentOf(openResume.versions, openResume.currentVersionId), node: <ResumePreview doc={currentOf(openResume.versions, openResume.currentVersionId).content} />, editHref: openResume.jobId ? `/jobs/${openResume.jobId}?doc=resume&mode=edit` : "/master?doc=resume&mode=edit" }
    : openLetter
      ? { title: openLetter.jobId ? `${jobName(openLetter.jobId) ?? "Application"} cover letter` : "Master Cover Letter", v: currentOf(openLetter.versions, openLetter.currentVersionId), node: <CoverLetterPreview doc={currentOf(openLetter.versions, openLetter.currentVersionId).content} />, editHref: openLetter.jobId ? `/jobs/${openLetter.jobId}?doc=cover-letter&mode=edit` : "/master?doc=cover-letter&mode=edit" }
      : null;

  return (
    <>
      <PageHeader title="Documents" description="Your Master Resume and Cover Letter, and every resume and cover letter you created for a job. Edit, download or delete any of them." />
      <div className="flex flex-col gap-ds-6">
        <section aria-labelledby="master-h" className="flex flex-col gap-ds-3">
          <div>
            <h2 id="master-h" className="text-heading-section">
              Master documents
            </h2>
            <p className="text-body-sm">The starting point for every application. Tailoring to a job never changes them.</p>
          </div>
          <ul className="flex flex-col gap-ds-2">
            {masterResume ? (
              <DocumentRow
                title="Master Resume"
                kindLabel="Master Resume"
                versions={masterResume.versions}
                currentVersionId={masterResume.currentVersionId}
                viewHref={`/documents?view=${masterResume.id}`}
                editHref="/master?doc=resume&mode=edit"
                downloadBase={dl("master", "resume")}
                deleteButton={<DeleteDocumentButton kind="resume" id={masterResume.id} label="Master Resume" consequence="Your profile and your applications aren't affected. You can create a new Master Resume from your profile any time." />}
              />
            ) : (
              <MissingRow href="/master" action="Create from profile">
                You don&apos;t have a Master Resume.
              </MissingRow>
            )}
            {masterLetter ? (
              <DocumentRow
                title="Master Cover Letter"
                kindLabel="Master Cover Letter"
                versions={masterLetter.versions}
                currentVersionId={masterLetter.currentVersionId}
                viewHref={`/documents?view=${masterLetter.id}`}
                editHref="/master?doc=cover-letter&mode=edit"
                downloadBase={dl("master", "cover-letter")}
                deleteButton={<DeleteDocumentButton kind="cover-letter" id={masterLetter.id} label="Master Cover Letter" consequence="Your profile and your applications aren't affected. You can create a new Master Cover Letter from your profile any time." />}
              />
            ) : (
              <MissingRow href="/master?doc=cover-letter" action="Create from profile">
                You don&apos;t have a Master Cover Letter.
              </MissingRow>
            )}
          </ul>
        </section>

        <section aria-labelledby="apps-h" className="flex flex-col gap-ds-4">
          <div>
            <h2 id="apps-h" className="text-heading-section">
              Applications
            </h2>
            <p className="text-body-sm">The resume and cover letter you created for each job, grouped by company.</p>
          </div>
          {groups.length === 0 ? (
            <ul>
              <MissingRow href="/dashboard#tailor" action="Tailor to a job">
                Resumes and cover letters you create for a job appear here.
              </MissingRow>
            </ul>
          ) : (
            groups.map(({ job, resume, letter }) => (
              <div key={job.id} role="group" aria-labelledby={`co-${job.id}`} className="flex flex-col gap-ds-2">
                <div>
                  <h3 id={`co-${job.id}`} className="text-card-title">
                    {job.company}
                  </h3>
                  <p className="text-body-sm">{job.title}</p>
                </div>
                <ul className="flex flex-col gap-ds-2">
                  {resume && (
                    <DocumentRow
                      title="Resume"
                      kindLabel={`${job.company} resume`}
                      versions={resume.versions}
                      currentVersionId={resume.currentVersionId}
                      viewHref={`/documents?view=${resume.id}`}
                      editHref={`/jobs/${job.id}?doc=resume&mode=edit`}
                      downloadBase={dl(job.id, "resume")}
                      deleteButton={<DeleteDocumentButton kind="resume" id={resume.id} label={`${job.company} resume`} consequence="The application stays, so you can create the resume again from its match page." />}
                    />
                  )}
                  {letter && (
                    <DocumentRow
                      title="Cover letter"
                      kindLabel={`${job.company} cover letter`}
                      versions={letter.versions}
                      currentVersionId={letter.currentVersionId}
                      viewHref={`/documents?view=${letter.id}`}
                      editHref={`/jobs/${job.id}?doc=cover-letter&mode=edit`}
                      downloadBase={dl(job.id, "cover-letter")}
                      deleteButton={<DeleteDocumentButton kind="cover-letter" id={letter.id} label={`${job.company} cover letter`} consequence="The application stays, so you can write the cover letter again." />}
                    />
                  )}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>
      {opened && (
        <ViewWindow key={view} title={opened.title} subtitle={`Version ${opened.v.number} · ${formatDate(opened.v.createdAt)}`} editHref={opened.editHref} closeHref="/documents">
          {opened.node}
        </ViewWindow>
      )}
    </>
  );
}
