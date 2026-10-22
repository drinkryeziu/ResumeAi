"use client";

import { useActionState } from "react";
import { addViewer } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/Button";
import { errorProps, Field, Input } from "@/components/ui/Field";

/** The owner types the email of an existing account to let that person open the dashboard. */
export function AddViewerForm() {
  const [state, action, pending] = useActionState(addViewer, undefined);
  return (
    <form action={action} className="flex flex-col gap-ds-3">
      <Field label="Email of an existing account" htmlFor="viewer-email" required error={state?.error}>
        <Input id="viewer-email" name="email" type="email" required autoComplete="off" placeholder="name@example.com" {...errorProps("viewer-email", state?.error)} />
      </Field>
      <div className="flex flex-wrap items-center gap-ds-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add viewer"}
        </Button>
        {state?.ok && (
          <p role="status" className="text-body-sm text-success">
            {state.ok}
          </p>
        )}
      </div>
    </form>
  );
}
