import Link from "next/link";
import { PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { IconLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { VersionLabel } from "@/server/store/types";
import { DownloadDialog } from "./DownloadDialog";

const LABEL: Record<VersionLabel, string> = { ORIGINAL: "Original", AI_OPTIMIZED: "AI written", USER_EDITED: "Your edits", FINAL: "Final" };

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
    <li className="relative grid items-center gap-x-ds-4 gap-y-ds-2 rounded-md bg-sky-50 px-ds-4 py-ds-3 transition-shadow hover:shadow-card sm:grid-cols-[minmax(0,1fr)_auto_auto]" aria-label={kindLabel}>
      {/* The whole row opens the document: this link is stretched over it, and the controls below sit above it. */}
      <p className="text-label-bold">
        <Link
          href={viewHref}
          scroll={false}
          aria-label={`Open ${kindLabel}`}
          className="no-underline after:absolute after:inset-0 after:rounded-md after:content-[''] hover:text-blue-700 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-blue-600"
        >
          {title}
        </Link>
      </p>

      <details className="relative z-10 text-body-sm sm:text-right">
        <summary className="cursor-pointer list-none text-body-sm [&::-webkit-details-marker]:hidden">
          <span className="underline decoration-dotted underline-offset-4">
            Version {current?.number ?? 1} · {current ? formatDate(current.createdAt) : ""}
          </span>
          <span className="sr-only"> — show all {versions.length} versions</span>
        </summary>
        <ol className="mt-ds-2 flex flex-col gap-1 text-left">
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

      <div className="relative z-10 flex items-center gap-ds-2 sm:justify-end">
        <IconLink href={editHref} label={`Edit ${kindLabel}`} tone="blue">
          <PenLine size={18} aria-hidden="true" />
        </IconLink>
        {deleteButton}
        <DownloadDialog iconOnly docLabel={kindLabel} pdfHref={`${downloadBase}&format=pdf`} docxHref={`${downloadBase}&format=docx`} />
      </div>
    </li>
  );
}
