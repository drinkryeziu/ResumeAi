import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import JSZip from "jszip";
import type { CoverLetterDocument, ResumeDocument } from "./model";
import { coverLetterDocx, resumeDocx } from "./templates/classic/docx";
import { CoverLetterPdf, ResumePdf } from "./templates/classic/pdf";

/**
 * Template registry. A new template = a folder with pdf.tsx + docx.ts, registered here.
 * Business logic only ever calls exportResume / exportCoverLetter / exportPackage.
 */
const TEMPLATES = {
  classic: { resumePdf: ResumePdf, coverPdf: CoverLetterPdf, resumeDocx, coverLetterDocx },
} as const;
type TemplateId = keyof typeof TEMPLATES;
const tpl = (id: string) => TEMPLATES[(id in TEMPLATES ? id : "classic") as TemplateId];

export type ExportFormat = "pdf" | "docx";

export const MIME: Record<ExportFormat | "zip", string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  zip: "application/zip",
};

export async function exportResume(doc: ResumeDocument, format: ExportFormat): Promise<Buffer> {
  const t = tpl(doc.templateId);
  return format === "pdf" ? renderToBuffer(<t.resumePdf doc={doc} />) : t.resumeDocx(doc);
}

export async function exportCoverLetter(doc: CoverLetterDocument, format: ExportFormat, templateId = "classic"): Promise<Buffer> {
  const t = tpl(templateId);
  return format === "pdf" ? renderToBuffer(<t.coverPdf doc={doc} />) : t.coverLetterDocx(doc);
}

/** "Download application package": resume + cover letter, PDF and DOCX, in one ZIP. */
export async function exportPackage(resume: ResumeDocument, letter: CoverLetterDocument | null, baseName: string): Promise<Buffer> {
  const zip = new JSZip();
  for (const f of ["pdf", "docx"] as const) {
    zip.file(`${baseName}-Resume.${f}`, await exportResume(resume, f));
    if (letter) zip.file(`${baseName}-Cover-Letter.${f}`, await exportCoverLetter(letter, f, resume.templateId));
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

/** "Alex Rivera", "Northwind Financial" → "Alex-Rivera-Northwind-Financial" */
export const fileBase = (...parts: string[]) =>
  parts
    .join(" ")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
