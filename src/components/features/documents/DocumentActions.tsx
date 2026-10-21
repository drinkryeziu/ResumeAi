import { PenLine, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import type { DocTab } from "./DocumentWorkspace";
import { DownloadDialog } from "./DownloadDialog";

/**
 * The small link buttons beside a document's tabs: Close (back to Documents when opened from there, otherwise to the dashboard),
 * Edit (not while the editor is already open) and Download for the document being shown. The page keeps its own primary button.
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
      <ButtonLink href={fromDocuments ? "/documents" : "/dashboard"} variant="link" icon={<X size={16} aria-hidden="true" />} aria-label={fromDocuments ? "Close and go back to Documents" : "Close and go back to the dashboard"}>
        Close
      </ButtonLink>
      {hasDocument && !editing && (
        <ButtonLink href={`${basePath}?doc=${tab}&mode=edit${from}`} variant="link" icon={<PenLine size={16} aria-hidden="true" />} aria-label={`Edit ${docLabel}`}>
          Edit
        </ButtonLink>
      )}
      {hasDocument && (
        <DownloadDialog variant="link" docLabel={docLabel} pdfHref={download("pdf")} docxHref={download("docx")} zipHref={bothExist ? `/api/jobs/${target}/download?doc=package` : undefined} />
      )}
    </>
  );
}
