"use client";

import { useActionState, useRef } from "react";
import { addRunningCost } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/Button";
import { errorProps, Field, Input } from "@/components/ui/Field";

/** One fixed monthly cost of running the app: what it is for and how many dollars a month. */
export function AddRunningCostForm() {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof addRunningCost>>, fd: FormData) => {
    const next = await addRunningCost(prev, fd);
    if (next?.ok) form.current?.reset();
    return next;
  }, undefined);
  return (
    <form ref={form} action={action} className="flex flex-col gap-ds-3">
      <div className="grid gap-ds-3 sm:grid-cols-[2fr_1fr]">
        <Field label="What it is for" htmlFor="cost-label" required error={state?.error && /name|for/i.test(state.error) ? state.error : undefined}>
          <Input id="cost-label" name="label" required maxLength={60} placeholder="Hosting" autoComplete="off" {...errorProps("cost-label", state?.error && /name|for/i.test(state.error) ? state.error : undefined)} />
        </Field>
        <Field label="Dollars per month" htmlFor="cost-amount" required error={state?.error && !/name|for/i.test(state.error) ? state.error : undefined}>
          <Input id="cost-amount" name="amount" required inputMode="decimal" placeholder="20" autoComplete="off" {...errorProps("cost-amount", state?.error && !/name|for/i.test(state.error) ? state.error : undefined)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-ds-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Adding…" : "Add cost"}
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
