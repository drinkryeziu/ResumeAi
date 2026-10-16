import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate } from "@/lib/format";
import { requireProfile } from "@/server/auth/session";
import { getStore } from "@/server/store";

export const metadata = { title: "Documents" };

/** Phase 1: list of generated documents with download. Rename / duplicate / delete arrive in phase 4. */
export default async function DocumentsPage() {
  const { user } = await requireProfile();
  const store = await getStore();
  const [resumes, letters, matches] = await Promise.all([store.listResumes(user.id), store.listCoverLetters(user.id), store.listJobs(user.id)]);
  const jobs = new Map(matches.map((j) => [j.id, j]));
  const scores = new Map(await Promise.all(matches.map(async (j) => [j.id, (await store.latestMatch(user.id, j.id))?.overallScore ?? null] as const)));
  const rows = [
    ...resumes.map((r) => ({ id: r.id, kind: "Resume", doc: "resume", r })),
    ...letters.map((r) => ({ id: r.id, kind: "Cover letter", doc: "cover-letter", r })),
  ].sort((a, b) => +b.r.updatedAt - +a.r.updatedAt);

  return (
    <>
      <PageHeader title="My documents" description="Every resume and cover letter you've created, with its job and version." />
      <Card className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-body-sm">No documents yet — tailor your resume to a job to create one.</p>
        ) : (
          <table className="w-full min-w-[720px] text-body-sm">
            <thead>
              <tr className="text-left text-label-bold">
                {["Document", "Type", "Company", "Created", "Updated", "Version", "Match", ""].map((h) => (
                  <th key={h} className="pb-ds-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ id, kind, doc, r }) => {
                const job = r.jobId ? jobs.get(r.jobId) : undefined;
                const score = r.jobId ? scores.get(r.jobId) : null;
                return (
                  <tr key={id} className="border-t border-gray-100">
                    <td className="py-ds-2 pr-ds-3">
                      <Link href={r.jobId ? `/jobs/${r.jobId}?doc=${doc}` : `/master?doc=${doc}`} className="text-blue-700 underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-ds-2">{kind}</td>
                    <td className="py-ds-2">{job?.company ?? (r.jobId ? "—" : "Master")}</td>
                    <td className="py-ds-2">{formatDate(r.createdAt)}</td>
                    <td className="py-ds-2">{formatDate(r.updatedAt)}</td>
                    <td className="py-ds-2">V{r.versions.length}</td>
                    <td className="py-ds-2">{score == null ? "—" : `${score}%`}</td>
                    <td className="py-ds-2">
                      <a href={`/api/jobs/${r.jobId ?? "master"}/download?doc=${doc}&format=pdf`} className="text-blue-700 underline">
                        PDF
                      </a>{" "}
                      ·{" "}
                      <a href={`/api/jobs/${r.jobId ?? "master"}/download?doc=${doc}&format=docx`} className="text-blue-700 underline">
                        DOCX
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
