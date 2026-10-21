import Link from "next/link";
import { FileText, Mail, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { IconLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { VersionLabel } from "@/server/store/types";
import { DownloadDialog } from "./DownloadDialog";

const LABEL: Record<VersionLabel, string> = {
  ORIGINAL: "Original",
  AI_OPTIMIZED: "AI written",
  USER_EDITED: "Your edits",
  FINAL: "Final",
};

export interface DocumentVersion {
  id: string;
  number: number;
  label: VersionLabel;
  createdAt: Date;
}

/**
 * One document as one row: its name, its current version and date (open it to see every version), and Edit, Delete and
 * Download. Edit opens the same editing window as everywhere else; Download offers PDF or Word.
 */
export function DocumentRow({
  title,
  kind,
  kindLabel,
  versions,
  currentVersionId,
  viewHref,
  editHref,
  downloadBase,
  deleteButton,
}: {
  /** What the row is called: "Master Resume", "Resume", "Cover letter". */
  title: string;
  /** Picks the icon: a resume or a cover letter. */
  kind: "resume" | "cover-letter";
  /** Names the document for screen readers and the download window: "Northwind Financial resume". */
  kindLabel: string;
  versions: DocumentVersion[];
  currentVersionId: string;
  /** Opens the document for reading (the Documents page with `?view=<id>`). */
  viewHref: string;
  editHref: string;
  /** Download address without the format, e.g. `/api/jobs/master/download?doc=resume`. */
  downloadBase: string;
  deleteButton: ReactNode;
}) {
  const current = versions.find((v) => v.id === currentVersionId) ?? versions.at(-1);
  return (
    <li
      className="relative flex flex-wrap items-center gap-x-ds-3 gap-y-ds-2 rounded-md bg-gray-100 px-ds-3 py-ds-3 transition-shadow hover:shadow-card"
      aria-label={kindLabel}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-50 text-blue-600" aria-hidden="true">
        {kind === "resume" ? <FileText size={22} /> : <Mail size={22} />}
      </span>

      <div className="flex min-w-0 flex-1 basis-48 flex-col">
        {/* The whole row opens the document: this link is stretched over it, and the controls sit above it. */}
        <Link
          href={viewHref}
          aria-label={`Open ${kindLabel}`}
          className="text-label-bold no-underline after:absolute after:inset-0 after:rounded-md after:content-[''] hover:text-blue-700 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-blue-600"
        >
          {title}
        </Link>
        <details className="relative z-10 w-fit text-caption">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span className="underline decoration-dotted underline-offset-4">
              {current ? `Version ${current.number}, ${formatDate(current.createdAt)}` : "Version 1"}
            </span>
            <span className="sr-only"> — show all {versions.length} versions</span>
          </summary>
          <ol className="mt-ds-2 flex min-w-64 flex-col gap-1 text-body-sm">
            {[...versions].reverse().map((v) => (
              <li key={v.id} className={cn("flex items-center justify-between gap-ds-3 rounded-sm px-ds-2 py-1", v.id === currentVersionId && "bg-white")}>
                <span>
                  <span className="text-label-bold">V{v.number}</span> · {LABEL[v.label]}
                  <span className="text-caption"> · {formatDate(v.createdAt)}</span>
                </span>
                {v.id === currentVersionId && <Badge tone="info">Current</Badge>}
              </li>
            ))}
          </ol>
        </details>
      </div>

      <div className="relative z-10 flex items-center gap-ds-2">
        <IconLink href={editHref} label={`Edit ${kindLabel}`} tone="blue">
          <PenLine size={18} aria-hidden="true" />
        </IconLink>
        {deleteButton}
        <DownloadDialog iconOnly docLabel={kindLabel} pdfHref={`${downloadBase}&format=pdf`} docxHref={`${downloadBase}&format=docx`} />
      </div>
    </li>
  );
}
