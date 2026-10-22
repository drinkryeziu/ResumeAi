"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, ClipboardPaste, FileUp, Loader2, X } from "lucide-react";
import { importCv, type ProfileState } from "@/app/(app)/profile/actions";
import { BusyOverlay } from "@/components/ui/BusyOverlay";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { CV_MAX_MB, guideFor, type CvNext, type CvProblem } from "@/lib/cv-problems";

/** A request that never reached the server (connection lost, file too large for the host) comes back as an explained problem, not a crash. */
async function readCv(prev: ProfileState, fd: FormData): Promise<ProfileState> {
  try {
    return await importCv(prev, fd);
  } catch {
    return { problem: "network", error: guideFor("network").reason };
  }
}

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
  const [state, action] = useActionState(readCv, undefined);
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState("");
  // A problem found in the browser before sending (a file over the limit) is shown the same way as one the server reports.
  const [local, setLocal] = useState<{ problem: CvProblem; sizeMb?: number } | null>(null);
  const shown = local ?? (state?.problem ? { problem: state.problem, sizeMb: undefined } : null);
  const dialog = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (shown && dialog.current && !dialog.current.open) dialog.current.showModal();
    // Opens again for every new result, even the same problem twice (`state` and `local` are new objects each time).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, local]);
  const close = () => dialog.current?.close();
  const next = (n: CvNext) => {
    close();
    setLocal(null);
    if (n === "paste") {
      setMode("paste");
      requestAnimationFrame(() => pasteRef.current?.focus());
    } else if (n === "choose") {
      setMode("file");
      requestAnimationFrame(() => fileRef.current?.focus());
    }
  };
  const guide = shown ? guideFor(shown.problem, { sizeMb: shown.sizeMb }) : null;
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
    <form
      action={action}
      className="flex flex-col gap-ds-3"
      onSubmit={(e) => {
        const f = mode === "file" ? fileRef.current?.files?.[0] : undefined;
        if (f && f.size > CV_MAX_MB * 1_048_576) {
          e.preventDefault(); // too big for the host to accept: say so now, instead of failing after a long upload
          setLocal({ problem: "too_big", sizeMb: f.size / 1_048_576 });
        }
      }}
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="requestId" value={requestId} />
      <BusyOverlay title="Reading your CV…" />
      <div role="tablist" aria-label="How to add your CV" className="flex flex-wrap gap-ds-2">
        {tab("file", "Upload a file", <FileUp size={16} aria-hidden="true" />)}
        {tab("paste", "Paste text", <ClipboardPaste size={16} aria-hidden="true" />)}
      </div>

      {/* Both stay mounted; only the active one is named, so only it is posted. */}
      <div hidden={mode !== "file"} className="flex flex-wrap items-center gap-ds-4">
        <label className="flex min-w-64 flex-1 cursor-pointer items-center gap-ds-3 rounded-md bg-white px-ds-4 py-ds-3 shadow-card transition-shadow hover:shadow-search focus-within:outline focus-within:outline-2 focus-within:outline-blue-600">
          <FileUp size={24} className="shrink-0 text-blue-600" aria-hidden="true" />
          <span className="flex flex-col">
            <span className="text-label-bold">{fileName ?? (compact ? "Choose a CV file" : "Choose your CV")}</span>
            <span className="text-caption">PDF or Word (.docx), up to 4 MB</span>
          </span>
          <input
            ref={fileRef}
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
          ref={pasteRef}
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
      {guide && (
        <dialog
          ref={dialog}
          aria-labelledby="cv-problem-title"
          onClose={() => setLocal(null)}
          onClick={(e) => {
            if (e.target === dialog.current) close();
          }}
          className="m-auto w-[min(520px,calc(100%-32px))] rounded-md bg-white p-ds-5 text-left text-navy-900 shadow-card backdrop:bg-navy-900/50"
        >
          <div className="flex flex-col gap-ds-4">
            <div className="flex items-start justify-between gap-ds-3">
              <h2 id="cv-problem-title" className="flex items-center gap-ds-2 text-heading-section">
                <CircleAlert size={24} className="shrink-0 text-warning" aria-hidden="true" />
                {guide.title}
              </h2>
              <button type="button" onClick={close} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-gray-100">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="text-body">{guide.reason}</p>
            <div className="flex flex-col gap-ds-2">
              <p className="text-label-bold">How to fix it</p>
              <ol className="flex list-decimal flex-col gap-ds-2 pl-5 text-body-sm">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            {state?.detail && !local && (
              <details className="text-caption">
                <summary className="w-fit cursor-pointer underline">Technical details</summary>
                <p className="mt-ds-1 break-words">{state.detail}</p>
              </details>
            )}
            <div className="flex flex-wrap items-center justify-end gap-ds-3">
              {guide.next !== "close" && (
                <Button type="button" variant="secondary" onClick={close}>
                  Close
                </Button>
              )}
              <Button type="button" onClick={() => next(guide.next)}>
                {guide.nextLabel}
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </form>
  );
}
