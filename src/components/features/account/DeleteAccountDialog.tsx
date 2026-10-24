"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, X } from "lucide-react";
import { deleteMyAccount } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

function ConfirmButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={!ready || pending} icon={pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : undefined}>
      {pending ? "Deleting…" : "Delete everything"}
    </Button>
  );
}

/**
 * The only way to delete an account: a window that says what goes, and asks for the account's own email address.
 * A native <dialog> gives the focus trap, Escape and focus return. Cancel is the first button.
 */
export function DeleteAccountDialog({ email }: { email: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(deleteMyAccount, undefined);
  const [typed, setTyped] = useState("");
  const close = () => dialog.current?.close();
  const ready = typed.trim().toLowerCase() === email.toLowerCase();
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">
        Delete my account
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="delete-account-title"
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        className="m-auto w-[min(480px,calc(100%-32px))] rounded-md bg-white p-ds-5 text-navy-900 shadow-card backdrop:bg-navy-900/50"
      >
        <form action={action} className="flex flex-col gap-ds-4">
          <div className="flex items-start justify-between gap-ds-3">
            <h2 id="delete-account-title" className="text-heading-section">
              Delete your account?
            </h2>
            <button type="button" onClick={close} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-gray-100">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col gap-ds-2">
            <p className="text-body">
              This permanently deletes your profile, every application and its documents, and your credit history.{" "}
              <strong>It can&apos;t be undone.</strong>
            </p>
            <p className="text-body-sm">If you want a copy first, close this window and use “Download my data”.</p>
          </div>
          <Field label={`Type ${email} to confirm`} htmlFor="delete-email" required>
            <Input id="delete-email" name="email" type="email" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          {state?.error && (
            <p role="alert" className="text-body-sm text-danger">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-ds-3">
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <ConfirmButton ready={ready} />
          </div>
        </form>
      </dialog>
    </>
  );
}
