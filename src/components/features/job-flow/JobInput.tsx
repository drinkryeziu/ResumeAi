"use client";

import { useRef, useState } from "react";
import { ClipboardPaste, FileUp, X } from "lucide-react";
import { Textarea } from "@/components/ui/Field";

const link = "text-blue-700 underline focus-visible:outline-2 focus-visible:outline-blue-600";

/**
 * The job description, pasted or uploaded; one of the two is sent with the form. It opens as a plain text box. A link at the end of
 * its hint switches to the file upload, and the upload has a link at the top right that switches back.
 */
export function JobInput({ defaultText }: { defaultText?: string }) {
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [empty, setEmpty] = useState(!defaultText);
  const [fileName, setFileName] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const show = (m: "paste" | "upload") => {
    setMode(m);
    // The hidden side is hidden by the time this runs, so move focus to the side that is now showing.
    requestAnimationFrame(() => (m === "paste" ? textRef.current : fileRef.current)?.focus());
  };

  return (
    <div className="flex flex-col gap-ds-3">
      <div className="flex flex-wrap items-center justify-between gap-x-ds-4 gap-y-ds-1">
        <span className="text-label-bold">
          Job description <span aria-hidden="true">*</span>
        </span>
        {mode === "upload" && (
          <button type="button" onClick={() => show("paste")} className={`inline-flex items-center gap-1 text-body-sm ${link}`}>
            <ClipboardPaste size={16} aria-hidden="true" />
            Paste job description as text
          </button>
        )}
      </div>

      {/* Both controls stay mounted so the form always posts the active one; the other is emptied. */}
      <div hidden={mode !== "paste"} className="relative">
        <Textarea
          ref={textRef}
          name={mode === "paste" ? "description" : undefined}
          aria-label="Job description"
          aria-describedby="job-hint"
          defaultValue={defaultText}
          onChange={(e) => setEmpty(e.target.value === "")}
          className="min-h-80"
        />
        {/* Shown like a placeholder while the box is empty, so the link can sit at the end of the sentence. Only the link takes clicks. */}
        {empty && (
          <p id="job-hint" className="pointer-events-none absolute inset-x-0 top-0 px-ds-2 py-2.5 text-body text-gray-500">
            Paste the complete job description here — responsibilities and requirements included. You can also{" "}
            <button type="button" onClick={() => show("upload")} className={`pointer-events-auto ${link}`}>
              upload it as a file
            </button>
            .
          </p>
        )}
      </div>
      <div hidden={mode !== "upload"}>
        <label className="flex cursor-pointer flex-col items-center gap-ds-2 rounded-md bg-sky-50 p-ds-5 text-center transition-shadow hover:shadow-card focus-within:shadow-card focus-within:outline focus-within:outline-2 focus-within:outline-blue-600">
          <FileUp size={32} className="text-blue-600" aria-hidden="true" />
          <span className="text-label-bold">{fileName ?? "Choose a file"}</span>
          <span className="text-caption">PDF, Word (.docx) or text · up to 4 MB</span>
          <input
            ref={fileRef}
            type="file"
            name={mode === "upload" ? "file" : undefined}
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        {fileName && (
          <button
            type="button"
            className="mt-ds-2 inline-flex items-center gap-1 text-body-sm text-blue-700 underline"
            onClick={() => {
              if (fileRef.current) fileRef.current.value = "";
              setFileName(null);
            }}
          >
            <X size={14} aria-hidden="true" /> Remove file
          </button>
        )}
      </div>
    </div>
  );
}
