import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteDocumentButton } from "@/components/features/documents/DeleteDocumentButton";
import { DocumentCard } from "@/components/features/documents/DocumentCard";
import { requireProfile } from "@/server/auth/session";
import { getStore } from "@/server/store";

export const metadata = { title: "Documents" };

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-ds-3">
      <div>
        <h2 id={id} className="text-heading-section">
          {title}
        </h2>
        <p className="text-body-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

const EMPTY = "flex flex-col items-start gap-ds-3 text-body-sm";

/** Every document in one place: the Master documents first, then each resume and cover letter made for an application. */
export default async function DocumentsPage() {
  const { user } = await requireProfile();
  const store = await getStore();
  const [resumes, letters, jobs] = await Promise.all([store.listResumes(user.id), store.listCoverLetters(user.id), store.listJobs(user.id)]);
  const job = new Map(jobs.map((j) => [j.id, j]));

  const masterResume = resumes.find((r) => r.jobId === null) ?? null;
  const masterLetter = letters.find((l) => l.jobId === null) ?? null;
  // Newest first; documents whose job no longer exists are not listed.
  const forJobs = <T extends { jobId: string | null; updatedAt: Date }>(rows: T[]) => rows.filter((r) => r.jobId && job.has(r.jobId)).sort((a, b) => +b.updatedAt - +a.updatedAt);
  const jobResumes = forJobs(resumes);
  const jobLetters = forJobs(letters);

  const dl = (target: string, doc: "resume" | "cover-letter") => `/api/jobs/${target}/download?doc=${doc}`;

  return (
    <>
      <PageHeader title="Documents" description="Your Master Resume and Cover Letter, and every resume and cover letter you created for a job. Edit, download or delete any of them." />
      <div className="flex flex-col gap-ds-6">
        <Section id="master-h" title="Master documents" description="The starting point for every application. Tailoring to a job never changes them.">
          <div className="grid gap-ds-4 md:grid-cols-2">
            {masterResume ? (
              <DocumentCard
                title="Master Resume"
                kind="Resume"
                versions={masterResume.versions}
                currentVersionId={masterResume.currentVersionId}
                editHref="/master?doc=resume&mode=edit"
                downloadBase={dl("master", "resume")}
                deleteButton={<DeleteDocumentButton kind="resume" id={masterResume.id} label="Master Resume" consequence="Your profile and your applications aren't affected. You can create a new Master Resume from your profile any time." />}
              />
            ) : (
              <Card className={EMPTY}>
                <p>You don&apos;t have a Master Resume. Create one from your profile.</p>
                <ButtonLink href="/master" variant="secondary" compact>
                  Create from profile
                </ButtonLink>
              </Card>
            )}
            {masterLetter ? (
              <DocumentCard
                title="Master Cover Letter"
                kind="Cover letter"
                versions={masterLetter.versions}
                currentVersionId={masterLetter.currentVersionId}
                editHref="/master?doc=cover-letter&mode=edit"
                downloadBase={dl("master", "cover-letter")}
                deleteButton={<DeleteDocumentButton kind="cover-letter" id={masterLetter.id} label="Master Cover Letter" consequence="Your profile and your applications aren't affected. You can create a new Master Cover Letter from your profile any time." />}
              />
            ) : (
              <Card className={EMPTY}>
                <p>You don&apos;t have a Master Cover Letter. Create one from your profile.</p>
                <ButtonLink href="/master?doc=cover-letter" variant="secondary" compact>
                  Create from profile
                </ButtonLink>
              </Card>
            )}
          </div>
        </Section>

        <Section id="resumes-h" title="Resumes for applications" description="One for each job you tailored a resume to, titled with the company.">
          {jobResumes.length ? (
            <div className="grid gap-ds-4 md:grid-cols-2">
              {jobResumes.map((r) => {
                const j = job.get(r.jobId!)!;
                return (
                  <DocumentCard
                    key={r.id}
                    title={j.company}
                    subtitle={j.title}
                    kind="Resume"
                    versions={r.versions}
                    currentVersionId={r.currentVersionId}
                    editHref={`/jobs/${j.id}?doc=resume&mode=edit`}
                    downloadBase={dl(j.id, "resume")}
                    deleteButton={<DeleteDocumentButton kind="resume" id={r.id} label={`${j.company} resume`} consequence="The application stays, so you can create the resume again from its match page." />}
                  />
                );
              })}
            </div>
          ) : (
            <Card className={EMPTY}>
              <p>Resumes you create for a job appear here.</p>
              <ButtonLink href="/dashboard#tailor" variant="secondary" compact>
                Tailor to a job
              </ButtonLink>
            </Card>
          )}
        </Section>

        <Section id="letters-h" title="Cover letters for applications" description="One for each job you wrote a cover letter for, titled with the company.">
          {jobLetters.length ? (
            <div className="grid gap-ds-4 md:grid-cols-2">
              {jobLetters.map((l) => {
                const j = job.get(l.jobId!)!;
                return (
                  <DocumentCard
                    key={l.id}
                    title={j.company}
                    subtitle={j.title}
                    kind="Cover letter"
                    versions={l.versions}
                    currentVersionId={l.currentVersionId}
                    editHref={`/jobs/${j.id}?doc=cover-letter&mode=edit`}
                    downloadBase={dl(j.id, "cover-letter")}
                    deleteButton={<DeleteDocumentButton kind="cover-letter" id={l.id} label={`${j.company} cover letter`} consequence="The application stays, so you can write the cover letter again." />}
                  />
                );
              })}
            </div>
          ) : (
            <Card className={EMPTY}>
              <p>Cover letters you create for a job appear here.</p>
            </Card>
          )}
        </Section>
      </div>
    </>
  );
}
