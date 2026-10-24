"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, X } from "lucide-react";
import { deleteApplication } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/Button";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} icon={pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : undefined}>
      {pending ? "Deleting…" : "Delete application"}
    </Button>
  );
}

/**
 * The "X" on an application card. It never deletes on its own: it opens a confirmation dialog first.
 * A native <dialog> gives the focus trap, Escape to close and focus return for free; Cancel comes first in the
 * DOM so it is the focused control and a stray Enter cancels instead of deleting.
 */
export function DeleteApplicationButton({ jobId, title, company }: { jobId: string; title: string; company: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label={`Delete application: ${title} at ${company}`}
        className="grid size-10 shrink-0 place-items-center rounded-full text-navy-900 hover:bg-white hover:text-blue-700"
      >
        <X size={18} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`delete-${jobId}-title`}
        aria-describedby={`delete-${jobId}-body`}
        onClick={(e) => {
          if (e.target === dialog.current) close(); // a click on the dimmed backdrop cancels
        }}
        className="m-auto w-[min(440px,calc(100%-32px))] rounded-md bg-white p-ds-5 text-navy-900 shadow-card backdrop:bg-navy-900/50"
      >
        <form action={deleteApplication} className="flex flex-col gap-ds-4">
          <input type="hidden" name="jobId" value={jobId} />
          <div className="flex flex-col gap-ds-2">
            <h2 id={`delete-${jobId}-title`} className="text-heading-section">
              Delete this application?
            </h2>
            <p id={`delete-${jobId}-body`} className="text-body">
              <strong>
                {title} at {company}
              </strong>{" "}
              will be removed with its match report, tailored resume and cover letter. This can&apos;t be undone.
            </p>
            <p className="text-body-sm">Your profile isn&apos;t affected. Credits already used aren&apos;t refunded.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-ds-3">
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <ConfirmButton />
          </div>
        </form>
      </dialog>
    </>
  );
}
