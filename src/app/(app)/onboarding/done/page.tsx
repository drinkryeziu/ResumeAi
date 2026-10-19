import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { CoverLetterPreview, ResumePreview } from "@/components/features/documents/ResumePreview";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { requireProfile } from "@/server/auth/session";
import { getStore } from "@/server/store";

export const metadata = { title: "Your master documents" };

/** Shown right after the first save: both Master documents, ready to read, with the next step. */
export default async function OnboardingDonePage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const { user } = await requireProfile();
  const store = await getStore();
  const [resume, letter, balance] = await Promise.all([store.resumeForJob(user.id, null), store.coverLetterForJob(user.id, null), store.credits.balance(user.id)]);
  const resumeV = resume?.versions.find((v) => v.id === resume.currentVersionId);
  const letterV = letter?.versions.find((v) => v.id === letter.currentVersionId);
  if (!resumeV || !letterV) redirect("/master"); // nothing to show yet: the Master page can create them
  const tab = (await searchParams).doc === "cover-letter" ? "cover-letter" : "resume";
  const download = (doc: string, format: string) => `/api/jobs/master/download?doc=${doc}&format=${format}`;

  return (
    <>
      <PageHeader
        eyebrow="All set"
        title="Your Master Resume and Cover Letter are ready"
        description="Both were written only from the details you entered. Read them through. You can edit your profile any time and refresh them."
      />
      <div role="tablist" aria-label="Master documents" className="mb-ds-4 flex flex-wrap gap-ds-2">
        {(
          [
            ["resume", "Master Resume"],
            ["cover-letter", "Master Cover Letter"],
          ] as const
        ).map(([t, label]) => (
          <Link
            key={t}
            role="tab"
            aria-selected={tab === t}
            href={`/onboarding/done?doc=${t}`}
            className={cn(
              "inline-flex items-center rounded-pill px-ds-4 py-2 text-body-sm no-underline",
              tab === t ? "bg-blue-600 font-bold text-white" : "bg-gray-100 text-navy-900",
            )}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="grid gap-ds-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {tab === "resume" ? <ResumePreview doc={resumeV.content} /> : <CoverLetterPreview doc={letterV.content} />}
        <aside className="flex flex-col gap-ds-4">
          <Card className="flex flex-col gap-ds-3">
            <CardHeader title="Next" subtitle={`You have ${formatNumber(balance)} credits. Tailoring a resume and cover letter to a job uses about 35.`} />
            <ButtonLink href="/jobs" className="w-full">
              Tailor to your first job
            </ButtonLink>
            <div className="flex flex-wrap items-center gap-x-ds-4 gap-y-ds-2 text-body-sm">
              <span className="inline-flex items-center gap-1">
                <Download size={16} aria-hidden="true" className="text-blue-600" /> Download:
              </span>
              <a href={download(tab, "pdf")} className="text-blue-700 underline">
                PDF
              </a>
              <a href={download(tab, "docx")} className="text-blue-700 underline">
                Word (.docx)
              </a>
            </div>
            <div className="flex flex-wrap gap-x-ds-4 gap-y-ds-2 text-body-sm">
              <Link href={`/master?doc=${tab}&mode=edit`} className="text-blue-700 underline">
                Edit this document
              </Link>
              <Link href="/dashboard" className="text-blue-700 underline">
                Go to your dashboard
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
