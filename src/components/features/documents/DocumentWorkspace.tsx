import Link from "next/link";
import type { ReactNode } from "react";
import { FileText, Mail, Package } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import type { CoverLetterRecord, ResumeRecord } from "@/server/store/types";
import { restoreVersion } from "@/app/(app)/jobs/actions";
import { coverLetterPlainText, resumePlainText } from "@/server/documents/plain-text";
import { CopyTextButton } from "./CopyTextButton";
import { DownloadDialog } from "./DownloadDialog";
import { EditWindow } from "./EditWindow";
import { CoverLetterEditor, ResumeEditor } from "./DocumentEditors";
import { CoverLetterPreview, ResumePreview } from "./ResumePreview";

export type DocTab = "resume" | "cover-letter";
const LABEL = { ORIGINAL: "Original", AI_OPTIMIZED: "AI written", USER_EDITED: "Your edits", FINAL: "Final" } as const;

/**
 * Review & download for one target — a job (target = jobId) or the Master documents (target = "master").
 * Resume and Cover letter each get Preview | Edit | Download (PDF, Word); "Download both" gets the package.
 */
export function DocumentWorkspace({
  target,
  basePath,
  tab,
  editing,
  resume,
  letter,
  resumeSide,
  letterSide,
  fresh,
}: {
  target: string;
  basePath: string;
  tab: DocTab;
  editing: boolean;
  resume: ResumeRecord | null;
  letter: CoverLetterRecord | null;
  resumeSide?: ReactNode;
  letterSide?: ReactNode;
  /** Just created: keep `?new=1` on the document links so the step progress on the page stays while switching tabs. */
  fresh?: boolean;
}) {
  const download = (doc: string, format?: string) => `/api/jobs/${target}/download?doc=${doc}${format ? `&format=${format}` : ""}`;
  const resumeV = resume?.versions.find((v) => v.id === resume.currentVersionId) ?? null;
  const letterV = letter?.versions.find((v) => v.id === letter.currentVersionId) ?? null;
  const active = tab === "resume" ? resumeV : letterV;
  const here = (t: DocTab, edit = false) => `${basePath}?doc=${t}${edit ? "&mode=edit" : ""}${fresh ? "&new=1" : ""}`;

  return (
    <div className="flex flex-col gap-ds-4">
      <div className="flex flex-wrap items-end justify-between gap-x-ds-4 gap-y-ds-2 border-b-2 border-gray-100">
        <div role="tablist" aria-label="Documents" className="flex gap-ds-5">
          {(
            [
              ["resume", "Resume", <FileText key="r" size={16} aria-hidden="true" />, resumeV],
              ["cover-letter", "Cover letter", <Mail key="c" size={16} aria-hidden="true" />, letterV],
            ] as const
          ).map(([t, label, icon, v]) => (
            <Link
              key={t}
              role="tab"
              aria-selected={tab === t}
              href={here(t)}
              className={cn(
                "-mb-0.5 inline-flex items-center gap-2 border-b-[3px] px-ds-1 pt-ds-2 pb-ds-2 text-body-sm no-underline",
                tab === t ? "border-blue-600 font-bold text-blue-600" : "border-transparent text-navy-900 hover:text-blue-700",
              )}
            >
              {icon}
              {label}
              {v && <span className="text-micro opacity-90">V{v.number}</span>}
            </Link>
          ))}
        </div>
        {resumeV && (
          <a
            href={download("package")}
            className="mb-ds-2 inline-flex items-center gap-2 rounded-pill bg-blue-600 px-7 py-ds-3 text-button text-white no-underline hover:bg-blue-700"
          >
            <Package size={14} aria-hidden="true" />
            Download both
          </a>
        )}
      </div>

      <div className="grid gap-ds-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-ds-3">
          {tab === "resume" && (resumeV ? <ResumePreview doc={resumeV.content} /> : <Empty>No resume yet.</Empty>)}
          {tab === "cover-letter" && (letterV ? <CoverLetterPreview doc={letterV.content} /> : <Empty>No cover letter yet.</Empty>)}

          {active && (
            <div className="flex flex-col gap-ds-2">
              <div className="flex flex-wrap items-center justify-between gap-ds-3" aria-label="Download and edit">
                <DownloadDialog docLabel={tab === "resume" ? "resume" : "cover letter"} pdfHref={download(tab, "pdf")} docxHref={download(tab, "docx")} />
                <div className="flex flex-wrap items-center gap-x-ds-5 gap-y-ds-2">
                  <CopyTextButton variant="link" text={tab === "resume" ? resumePlainText(resumeV!.content) : coverLetterPlainText(letterV!.content)} />
                  <EditWindow
                    label={tab === "resume" ? "Edit resume" : "Edit cover letter"}
                    title={tab === "resume" ? "Edit your resume" : "Edit your cover letter"}
                    openInitially={editing}
                    closeHref={here(tab)}
                  >
                    {tab === "resume" ? (
                      <ResumeEditor doc={resumeV!.content} target={target} cancelHref={here("resume")} />
                    ) : (
                      <CoverLetterEditor doc={letterV!.content} target={target} cancelHref={here("cover-letter")} />
                    )}
                  </EditWindow>
                </div>
              </div>
              <p className="text-caption">Paste the text into an application form, or attach the file. You apply yourself; we never submit for you.</p>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-ds-4">
          {tab === "resume" ? resumeSide : letterSide}
          {tab === "resume" && resume && (
            <Card>
              <CardHeader title="Versions" subtitle="Restoring copies an old version forward — nothing is lost." />
              <ol className="flex flex-col gap-ds-2">
                {[...resume.versions].reverse().map((v) => (
                  <li key={v.id} className={cn("flex items-center justify-between gap-ds-2 rounded-sm px-ds-2 py-ds-2", v.id === resume.currentVersionId && "bg-sky-50")}>
                    <span className="flex flex-col">
                      <span className="text-label-bold">
                        V{v.number} · {LABEL[v.label]}
                      </span>
                      <span className="text-caption">{v.changeNotes[0] ?? formatDate(v.createdAt)}</span>
                    </span>
                    {v.id === resume.currentVersionId ? (
                      <Badge tone="info">Current</Badge>
                    ) : (
                      <form action={restoreVersion}>
                        <input type="hidden" name="jobId" value={target} />
                        <input type="hidden" name="resumeId" value={resume.id} />
                        <input type="hidden" name="versionId" value={v.id} />
                        <Button variant="link" type="submit">
                          Restore
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {tab === "cover-letter" && letter && (
            <Card>
              <CardHeader title="Versions" />
              <ol className="flex flex-col gap-ds-2">
                {[...letter.versions].reverse().map((v) => (
                  <li key={v.id} className={cn("flex justify-between rounded-sm px-ds-2 py-ds-2 text-body-sm", v.id === letter.currentVersionId && "bg-sky-50")}>
                    <span className="text-label-bold">
                      V{v.number} · {LABEL[v.label]}
                    </span>
                    <span className="text-caption capitalize">{v.tone.toLowerCase()}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <Card className="flex min-h-60 items-center justify-center text-body-sm">{children}</Card>;
}
