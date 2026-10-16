"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ClipboardPaste, FileUp, Loader2 } from "lucide-react";
import { importCv } from "@/app/(app)/profile/actions";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} icon={pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : undefined}>
      {pending ? "Reading your CV…" : "Read my CV"}
    </Button>
  );
}

/** "Already have a CV?" — upload it or paste its text to pre-fill the profile form instead of typing everything. */
export function CvImport({ returnTo, requestId, compact }: { returnTo: "onboarding" | "edit"; requestId: string; compact?: boolean }) {
  const [state, action] = useActionState(importCv, undefined);
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState("");
  const tab = (m: "file" | "paste", label: string, icon: React.ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => setMode(m)}
      className={cn("inline-flex items-center gap-2 rounded-pill px-ds-4 py-2 text-body-sm", mode === m ? "bg-blue-600 font-bold text-white" : "bg-white text-navy-900")}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <form action={action} className="flex flex-col gap-ds-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="requestId" value={requestId} />
      <div role="tablist" aria-label="How to add your CV" className="flex flex-wrap gap-ds-2">
        {tab("file", "Upload a file", <FileUp size={16} aria-hidden="true" />)}
        {tab("paste", "Paste text", <ClipboardPaste size={16} aria-hidden="true" />)}
      </div>

      {/* Both stay mounted; only the active one is named, so only it is posted. */}
      <div hidden={mode !== "file"} className="flex flex-wrap items-center gap-ds-4">
        <label className="flex min-w-64 flex-1 cursor-pointer items-center gap-ds-3 rounded-md border-2 border-dashed border-[#c9d3e3] bg-white px-ds-4 py-ds-3 hover:border-blue-600">
          <FileUp size={24} className="shrink-0 text-blue-600" aria-hidden="true" />
          <span className="flex flex-col">
            <span className="text-label-bold">{fileName ?? (compact ? "Choose a CV file" : "Choose your CV")}</span>
            <span className="text-caption">PDF or Word (.docx), up to 5 MB</span>
          </span>
          <input
            type="file"
            name={mode === "file" ? "cv" : undefined}
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
      </div>
      <div hidden={mode !== "paste"}>
        <Textarea
          name={mode === "paste" ? "cvText" : undefined}
          aria-label="CV text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the text of your CV here, with headings such as Experience, Education and Skills."
          className="min-h-64 bg-white"
        />
      </div>

      <div>
        <Submit disabled={mode === "file" ? !fileName : text.trim().length < 100} />
      </div>
      {state?.error && (
        <p role="alert" className="text-body-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
