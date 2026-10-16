"use client";

import { useRef, useState } from "react";
import { ClipboardPaste, FileUp, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Textarea } from "@/components/ui/Field";

/** "Upload Job Description" or "Copy & Paste Job Description" — one of the two is sent with the form. */
export function JobInput({ defaultText }: { defaultText?: string }) {
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tab = (m: "paste" | "upload", label: string, icon: React.ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => setMode(m)}
      className={cn("inline-flex items-center gap-2 rounded-pill px-ds-4 py-2 text-body-sm", mode === m ? "bg-blue-600 font-bold text-white" : "bg-gray-100 text-navy-900")}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-ds-3">
      <span className="text-label-bold">
        Job description <span aria-hidden="true">*</span>
      </span>
      <div role="tablist" aria-label="How to add the job description" className="flex flex-wrap gap-ds-2">
        {tab("paste", "Copy & paste", <ClipboardPaste size={16} aria-hidden="true" />)}
        {tab("upload", "Upload a file", <FileUp size={16} aria-hidden="true" />)}
      </div>

      {/* Both controls stay mounted so the form always posts the active one; the other is emptied. */}
      <div hidden={mode !== "paste"}>
        <Textarea
          name={mode === "paste" ? "description" : undefined}
          aria-label="Job description"
          placeholder="Paste the complete job description here — responsibilities and requirements included."
          defaultValue={defaultText}
          className="min-h-80"
        />
      </div>
      <div hidden={mode !== "upload"}>
        <label className="flex cursor-pointer flex-col items-center gap-ds-2 rounded-md border-2 border-dashed border-[#c9d3e3] bg-sky-50 p-ds-5 text-center hover:border-blue-600">
          <FileUp size={32} className="text-blue-600" aria-hidden="true" />
          <span className="text-label-bold">{fileName ?? "Choose a file"}</span>
          <span className="text-caption">PDF, Word (.docx) or text · up to 5 MB</span>
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
