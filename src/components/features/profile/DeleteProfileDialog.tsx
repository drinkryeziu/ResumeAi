"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, X } from "lucide-react";
import { deleteMyProfile } from "@/app/(app)/profile/actions";
import { Button } from "@/components/ui/Button";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending} icon={pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : undefined}>
      {pending ? "Deleting…" : "Yes, delete my profile"}
    </Button>
  );
}

/**
 * "Delete my profile": a window that says what goes and what stays, and asks once. A native <dialog> gives the
 * focus trap, Escape and focus return. Cancel comes first so it is the safe default.
 */
export function DeleteProfileDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  return (
    <>
      <Button type="button" variant="danger" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">
        Delete my profile
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="delete-profile-title"
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        className="m-auto w-[min(480px,calc(100%-32px))] rounded-md bg-white p-ds-5 text-navy-900 shadow-card backdrop:bg-navy-900/50"
      >
        <form action={deleteMyProfile} className="flex flex-col gap-ds-4">
          <div className="flex items-start justify-between gap-ds-3">
            <h2 id="delete-profile-title" className="text-heading-section">
              Delete your profile?
            </h2>
            <button type="button" onClick={close} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-gray-100">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col gap-ds-2">
            <p className="text-body">
              This deletes your professional profile, including your jobs, education, skills and answers, and your Master Resume and Master Cover Letter.{" "}
              <strong>It can&apos;t be undone.</strong>
            </p>
            <p className="text-body-sm">You&apos;ll start again from the beginning to create a new profile. Your account, credits and applications you already created stay.</p>
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
