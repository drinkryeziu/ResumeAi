"use client";

import { useId, type RefObject } from "react";
import { ClipboardPaste, FileUp, X } from "lucide-react";
import { Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

const link = "text-blue-700 underline focus-visible:outline-2 focus-visible:outline-blue-600";

export type TextOrFileMode = "paste" | "upload";

/**
 * Something the person can either paste or upload as a file (a job description, a CV): one of the two is sent with the form.
 * It opens as a plain text box. A link at the end of its hint switches to the file upload, and the upload has a link at the top
 * right that switches back. The parent owns the state, so it can read the text, the chosen file and which side is showing.
 */
export function TextOrFile({
  label,
  required,
  mode,
  onModeChange,
  text,
  onTextChange,
  fileName,
  onFileChange,
  textRef,
  fileRef,
  textName,
  fileInputName,
  ariaLabel,
  hint,
  uploadLinkText = "upload it as a file",
  pasteLinkText,
  fileTitle,
  fileHelp,
  accept,
  minHeight = "min-h-80",
  onTint = false,
}: {
  label: string;
  required?: boolean;
  mode: TextOrFileMode;
  onModeChange: (m: TextOrFileMode) => void;
  text: string;
  onTextChange: (t: string) => void;
  fileName: string | null;
  onFileChange: (name: string | null) => void;
  textRef: RefObject<HTMLTextAreaElement | null>;
  fileRef: RefObject<HTMLInputElement | null>;
  /** The form field names: only the side that is showing is named, so only it is posted. */
  textName: string;
  fileInputName: string;
  ariaLabel: string;
  /** The sentence shown inside the empty text box, before the upload link. */
  hint: string;
  uploadLinkText?: string;
  /** The link at the top right of the upload, e.g. "Paste CV as text". */
  pasteLinkText: string;
  /** The upload's title while no file is chosen, and its small print. */
  fileTitle: string;
  fileHelp: string;
  accept: string;
  minHeight?: string;
  /** On a sky-50 panel the text box and the upload are white instead of tinted. */
  onTint?: boolean;
}) {
  const hintId = useId();
  const show = (m: TextOrFileMode) => {
    onModeChange(m);
    // The hidden side is hidden by the time this runs, so move focus to the side that is now showing.
    requestAnimationFrame(() => (m === "paste" ? textRef.current : fileRef.current)?.focus());
  };

  return (
    <div className="flex flex-col gap-ds-3">
      <div className="flex flex-wrap items-center justify-between gap-x-ds-4 gap-y-ds-1">
        <span className="text-label-bold">
          {label}
          {required && (
            <>
              {" "}
              <span aria-hidden="true">*</span>
            </>
          )}
        </span>
        {mode === "upload" && (
          <button type="button" onClick={() => show("paste")} className={`inline-flex items-center gap-1 text-body-sm ${link}`}>
            <ClipboardPaste size={16} aria-hidden="true" />
            {pasteLinkText}
          </button>
        )}
      </div>

      {/* Both controls stay mounted so the form always posts the active one; the other is emptied. */}
      <div hidden={mode !== "paste"} className="relative">
        <Textarea
          ref={textRef}
          name={mode === "paste" ? textName : undefined}
          aria-label={ariaLabel}
          aria-describedby={hintId}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          className={cn(minHeight, onTint && "bg-white")}
        />
        {/* Shown like a placeholder while the box is empty, so the link can sit at the end of the sentence. Only the link takes clicks. */}
        {text === "" && (
          <p id={hintId} className="pointer-events-none absolute inset-x-0 top-0 px-ds-2 py-2.5 text-body text-gray-500">
            {hint}{" "}
            <button type="button" onClick={() => show("upload")} className={`pointer-events-auto ${link}`}>
              {uploadLinkText}
            </button>
            .
          </p>
        )}
      </div>
      <div hidden={mode !== "upload"}>
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center gap-ds-2 rounded-md p-ds-5 text-center transition-shadow hover:shadow-card focus-within:shadow-card focus-within:outline focus-within:outline-2 focus-within:outline-blue-600",
            onTint ? "bg-white" : "bg-sky-50",
          )}
        >
          <FileUp size={32} className="text-blue-600" aria-hidden="true" />
          <span className="text-label-bold">{fileName ?? fileTitle}</span>
          <span className="text-caption">{fileHelp}</span>
          <input
            ref={fileRef}
            type="file"
            name={mode === "upload" ? fileInputName : undefined}
            accept={accept}
            className="sr-only"
            onChange={(e) => onFileChange(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        {fileName && (
          <button
            type="button"
            className="mt-ds-2 inline-flex items-center gap-1 text-body-sm text-blue-700 underline"
            onClick={() => {
              if (fileRef.current) fileRef.current.value = "";
              onFileChange(null);
            }}
          >
            <X size={14} aria-hidden="true" /> Remove file
          </button>
        )}
      </div>
    </div>
  );
}
