"use client";

import { BrandText } from "@/components/ui/Brand";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, Loader2, X } from "lucide-react";
import { importCv, type ProfileState } from "@/app/(app)/profile/actions";
import { BusyOverlay } from "@/components/ui/BusyOverlay";
import { Button } from "@/components/ui/Button";
import { TextOrFile, type TextOrFileMode } from "@/components/ui/TextOrFile";
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
  const [mode, setMode] = useState<TextOrFileMode>("paste");
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
      setMode("upload");
      requestAnimationFrame(() => fileRef.current?.focus());
    }
  };
  const guide = shown ? guideFor(shown.problem, { sizeMb: shown.sizeMb }) : null;
  return (
    <form
      action={action}
      className="flex flex-col gap-ds-3"
      onSubmit={(e) => {
        const f = mode === "upload" ? fileRef.current?.files?.[0] : undefined;
        if (f && f.size > CV_MAX_MB * 1_048_576) {
          e.preventDefault(); // too big for the host to accept: say so now, instead of failing after a long upload
          setLocal({ problem: "too_big", sizeMb: f.size / 1_048_576 });
        }
      }}
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="requestId" value={requestId} />
      <BusyOverlay title="Reading your CV…" />
      <TextOrFile
        label="Your CV"
        mode={mode}
        onModeChange={setMode}
        text={text}
        onTextChange={setText}
        fileName={fileName}
        onFileChange={setFileName}
        textRef={pasteRef}
        fileRef={fileRef}
        textName="cvText"
        fileInputName="cv"
        ariaLabel="CV text"
        hint="Paste the text of your CV here, with headings such as Experience, Education and Skills. You can also"
        pasteLinkText="Paste CV as text"
        fileTitle={compact ? "Choose a CV file" : "Choose your CV"}
        fileHelp="PDF or Word (.docx) · up to 4 MB"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        minHeight="min-h-64"
        onTint
      />

      <div>
        <Submit disabled={mode === "upload" ? !fileName : text.trim().length < 100} />
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
                  <li key={step}>
                    <BrandText>{step}</BrandText>
                  </li>
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
