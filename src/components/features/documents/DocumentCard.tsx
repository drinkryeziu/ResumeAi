import { PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
 * One document in the Documents tab: a title (the company it was made for, or "Master Resume"), what it is, its versions,
 * and Edit, Download and Delete. Edit opens the same editing window as everywhere else; Download offers PDF or Word.
 */
export function DocumentCard({
  title,
  subtitle,
  kind,
  versions,
  currentVersionId,
  editHref,
  downloadBase,
  deleteButton,
}: {
  title: string;
  subtitle?: string;
  kind: "Resume" | "Cover letter";
  versions: DocumentVersion[];
  currentVersionId: string;
  editHref: string;
  /** Download address without the format, e.g. `/api/jobs/master/download?doc=resume`. */
  downloadBase: string;
  deleteButton: ReactNode;
}) {
  const current = versions.find((v) => v.id === currentVersionId) ?? versions.at(-1);
  const docLabel = title.toLowerCase().endsWith(kind.toLowerCase()) ? title : `${title} ${kind.toLowerCase()}`; // "Master Resume", "Northwind Financial resume"
  return (
    <Card className="flex flex-col gap-ds-3" aria-label={docLabel}>
      <header className="flex flex-col gap-ds-1">
        <h3 className="text-card-title">{title}</h3>
        {subtitle && <p className="text-body-sm">{subtitle}</p>}
        <p className="flex flex-wrap items-center gap-ds-2 pt-ds-1">
          <Badge tone="info">{kind}</Badge>
          {current && (
            <span className="text-caption">
              Version {current.number} · updated {formatDate(current.createdAt)}
            </span>
          )}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-x-ds-3 gap-y-ds-2">
        <ButtonLink href={editHref} variant="secondary" compact icon={<PenLine size={16} aria-hidden="true" />} aria-label={`Edit ${docLabel}`}>
          Edit
        </ButtonLink>
        <DownloadDialog variant="secondary" docLabel={docLabel} pdfHref={`${downloadBase}&format=pdf`} docxHref={`${downloadBase}&format=docx`} />
        {deleteButton}
      </div>

      <details className="text-body-sm">
        <summary className="cursor-pointer text-blue-700 underline">
          Versions ({versions.length})
        </summary>
        <ol className="mt-ds-2 flex flex-col gap-1">
          {[...versions].reverse().map((v) => (
            <li key={v.id} className={cn("flex items-center justify-between gap-ds-2 rounded-sm px-ds-2 py-1", v.id === currentVersionId && "bg-sky-50")}>
              <span>
                <span className="text-label-bold">V{v.number}</span> · {LABEL[v.label]}
                <span className="text-caption"> · {formatDate(v.createdAt)}</span>
              </span>
              {v.id === currentVersionId && <Badge tone="info">Current</Badge>}
            </li>
          ))}
        </ol>
      </details>
    </Card>
  );
}
