"use client";

import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { deleteDocument } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/Button";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} icon={pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : undefined}>
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

/**
 * "Delete" on one document. It never deletes on its own: it opens a confirmation window first, with Cancel as the first
 * control so a stray Enter cancels. `consequence` says what else changes (for example that an application can be finished again).
 */
export function DeleteDocumentButton({ kind, id, label, consequence }: { kind: "resume" | "cover-letter"; id: string; label: string; consequence: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const close = () => dialog.current?.close();
  return (
    <>
      <Button type="button" variant="danger" compact icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => dialog.current?.showModal()} aria-haspopup="dialog" aria-label={`Delete ${label}`}>
        <span className="sr-only sm:not-sr-only">Delete</span>
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-body`}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        className="m-auto w-[min(440px,calc(100%-32px))] rounded-md bg-white p-ds-5 text-navy-900 shadow-card backdrop:bg-navy-900/50"
      >
        <form action={deleteDocument} className="flex flex-col gap-ds-4">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <div className="flex flex-col gap-ds-2">
            <h2 id={`${uid}-title`} className="text-heading-section">
              Delete this {kind === "resume" ? "resume" : "cover letter"}?
            </h2>
            <p id={`${uid}-body`} className="text-body">
              <strong>{label}</strong> will be removed with all of its versions. This can&apos;t be undone.
            </p>
            <p className="text-body-sm">{consequence}</p>
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
