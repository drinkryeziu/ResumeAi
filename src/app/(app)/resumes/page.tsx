import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate } from "@/lib/format";
import { requireProfile } from "@/server/auth/session";
import { getStore } from "@/server/store";

export const metadata = { title: "My resumes" };

export default async function ResumesPage() {
  const { user } = await requireProfile();
  const resumes = await (await getStore()).listResumes(user.id);
  return (
    <>
      <PageHeader title="My resumes" description="Your Master Resume plus one tailored resume per job, each with its full version history." />
      {resumes.length === 0 ? (
        <Card>
          <p className="text-body-sm">No resumes yet.</p>
        </Card>
      ) : (
        <ul className="grid gap-ds-4 md:grid-cols-2">
          {resumes.map((r) => (
            <li key={r.id}>
              <Link href={r.jobId ? `/jobs/${r.jobId}?doc=resume` : "/master?doc=resume"} className="flex flex-col gap-ds-2 rounded-md bg-white p-ds-4 no-underline shadow-card hover:shadow-[0_0_0_2px_var(--blue-600)]">
                <span className="text-card-title text-blue-600">{r.name}</span>
                <span className="text-body-sm">
                  {r.versions.length} versions · updated {formatDate(r.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
