import "server-only";

/**
 * Turns an uploaded job description (or resume) into plain text.
 * The type is decided by the file's first bytes, not its name: PDF = "%PDF", DOCX = a ZIP ("PK").
 */
/** 4 MB: Vercel rejects request bodies over about 4.5 MB (file plus form overhead), so a larger limit would only fail later with a worse error. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export class UploadError extends Error {}

export async function extractText(file: File): Promise<string> {
  if (file.size === 0) throw new UploadError("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("That file is larger than 4 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const head = buf.subarray(0, 4).toString("latin1");

  let text: string;
  if (head.startsWith("%PDF")) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    text = (await pdfText(pdf, { mergePages: true })).text;
  } else if (head.startsWith("PK")) {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (/\.(txt|md)$/i.test(file.name) || file.type.startsWith("text/")) {
    text = buf.toString("utf8");
  } else {
    throw new UploadError("Upload a PDF, Word (.docx) or text file.");
  }

  text = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 100) throw new UploadError("We couldn't read enough text from that file. If it's a scanned image, paste the text instead.");
  return text;
}
