import { PenLine, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import type { DocTab } from "./DocumentWorkspace";
import { DownloadDialog } from "./DownloadDialog";

/**
 * The buttons at the top of a document page: Close (back to Documents, only when opened from there), Edit (not while the
 * editor is already open) and Download for the document being shown. Pages add their own primary button after these.
 */
export function DocumentActions({
  target,
  basePath,
  tab,
  editing,
  fromDocuments,
  hasDocument,
  docLabel,
  bothExist = false,
}: {
  target: string;
  basePath: string;
  tab: DocTab;
  editing: boolean;
  fromDocuments: boolean;
  hasDocument: boolean;
  /** Names the document in the download window: "Northwind Financial resume", "Master Resume". */
  docLabel: string;
  /** A resume and a cover letter both exist: the download window also offers them together. */
  bothExist?: boolean;
}) {
  const from = fromDocuments ? "&from=documents" : "";
  const download = (format: string) => `/api/jobs/${target}/download?doc=${tab}&format=${format}`;
  return (
    <>
      {fromDocuments && (
        <ButtonLink href="/documents" variant="secondary" compact icon={<X size={16} aria-hidden="true" />}>
          Close
        </ButtonLink>
      )}
      {hasDocument && !editing && (
        <ButtonLink href={`${basePath}?doc=${tab}&mode=edit${from}`} variant="secondary" compact icon={<PenLine size={16} aria-hidden="true" />}>
          Edit
        </ButtonLink>
      )}
      {hasDocument && <DownloadDialog variant="secondary" docLabel={docLabel} pdfHref={download("pdf")} docxHref={download("docx")} zipHref={bothExist ? `/api/jobs/${target}/download?doc=package` : undefined} />}
    </>
  );
}
