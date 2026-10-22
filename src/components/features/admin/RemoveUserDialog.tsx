"use client";

import { useActionState, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, X } from "lucide-react";
import { removeUser } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

function ConfirmButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={!ready || pending} icon={pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : undefined}>
      {pending ? "Deleting…" : "Delete account"}
    </Button>
  );
}

/**
 * Owner only. A window that names the person, says what goes, and asks for their email address before anything is deleted.
 * A native <dialog> gives the focus trap, Escape and focus return. Cancel is the first button.
 */
export function RemoveUserDialog({ userId, name, email }: { userId: string; name: string; email: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [state, action] = useActionState(removeUser, undefined);
  const [typed, setTyped] = useState("");
  const close = () => dialog.current?.close();
  const ready = typed.trim().toLowerCase() === email.toLowerCase();
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog" aria-label={`Delete the account of ${name}`} className="text-body-sm text-danger underline">
        Delete
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${uid}-title`}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        className="m-auto w-[min(480px,calc(100%-32px))] rounded-md bg-white p-ds-5 text-left text-navy-900 shadow-card backdrop:bg-navy-900/50"
      >
        <form action={action} className="flex flex-col gap-ds-4">
          <input type="hidden" name="userId" value={userId} />
          <div className="flex items-start justify-between gap-ds-3">
            <h2 id={`${uid}-title`} className="text-heading-section">
              Delete this account?
            </h2>
            <button type="button" onClick={close} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-gray-100">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col gap-ds-2">
            <p className="text-body">
              This permanently deletes the account of <strong>{name}</strong> ({email}): their profile, Master Resume and Cover Letter, every application and its documents, and their
              credit history. <strong>It can&apos;t be undone.</strong>
            </p>
            <p className="text-body-sm">They are not told, and they will no longer be able to sign in.</p>
          </div>
          <Field label={`Type ${email} to confirm`} htmlFor={`${uid}-email`} required>
            <Input id={`${uid}-email`} name="email" type="email" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          {state?.error && (
            <p role="alert" className="text-body-sm text-danger">
              {state.error}
            </p>
          )}
          {state?.ok && (
            <p role="status" className="text-body-sm text-success">
              {state.ok}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-ds-3">
            <Button type="button" variant="secondary" onClick={close}>
              {state?.ok ? "Close" : "Cancel"}
            </Button>
            <ConfirmButton ready={ready && !state?.ok} />
          </div>
        </form>
      </dialog>
    </>
  );
}
