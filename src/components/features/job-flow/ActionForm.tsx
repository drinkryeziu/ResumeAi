"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ActionState } from "@/app/(app)/jobs/actions";

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Wraps a server action: shows a pending state on the button, a plain-language error, and a
 * "buy credits" link when the balance is too low. `requestId` makes a double-click charge once.
 */
export function ActionForm({
  action,
  hidden,
  label,
  pendingLabel,
  cost,
  variant = "primary",
  fullWidth = false,
  requireOneOf,
  requireHint,
  children,
  className,
}: {
  action: Action;
  hidden: Record<string, string>;
  label: string;
  pendingLabel?: string;
  cost?: number;
  variant?: "primary" | "secondary";
  /** Stretch the button to its container — for a card whose main action is this button. */
  fullWidth?: boolean;
  /** The button stays disabled until at least one of these form fields has a value (text typed, or a file chosen). */
  requireOneOf?: string[];
  /** Shown under the disabled button so people know what is missing. */
  requireHint?: string;
  children?: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [filled, setFilled] = useState(!requireOneOf);
  const needs = requireOneOf?.join(",");

  // Re-check after typing, choosing a file, or switching between paste and upload (the active field changes name).
  useEffect(() => {
    const form = formRef.current;
    if (!form || !needs) return;
    const names = needs.split(",");
    const check = () =>
      setTimeout(() => {
        const fd = new FormData(form);
        setFilled(names.some((n) => fd.getAll(n).some((v) => (v instanceof File ? v.size > 0 : v.toString().trim() !== ""))));
      }, 0);
    check();
    const events = ["input", "change", "click"] as const;
    events.forEach((e) => form.addEventListener(e, check));
    return () => events.forEach((e) => form.removeEventListener(e, check));
  }, [needs]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <div className={cn("flex flex-col gap-ds-2", fullWidth ? "items-stretch" : "items-start")}>
        <Submit
          label={label}
          pendingLabel={pendingLabel}
          cost={cost}
          variant={variant}
          className={fullWidth ? "w-full" : undefined}
          blocked={!filled}
          describedBy={!filled && requireHint ? "action-hint" : undefined}
        />
        {!filled && requireHint && (
          <p id="action-hint" className="text-caption">
            {requireHint}
          </p>
        )}
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function Submit({
  label,
  pendingLabel,
  cost,
  variant,
  className,
  blocked,
  describedBy,
}: {
  label: string;
  pendingLabel?: string;
  cost?: number;
  variant: "primary" | "secondary";
  className?: string;
  blocked?: boolean;
  describedBy?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      className={className}
      disabled={pending || blocked}
      aria-describedby={describedBy}
      cost={pending ? undefined : cost}
      icon={pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : undefined}
    >
      {pending ? (pendingLabel ?? "Working…") : label}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.ok)
    return (
      <p role="status" className="text-body-sm text-success">
        {state.ok}
      </p>
    );
  return (
    <p role="alert" className="text-body-sm text-danger">
      {state.error}{" "}
      {state.needCredits && (
        <Link href="/credits" className="text-blue-700 underline">
          Buy credits
        </Link>
      )}
    </p>
  );
}
