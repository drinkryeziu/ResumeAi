"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { BusyOverlay } from "@/components/ui/BusyOverlay";
import { CreditLimitDialog } from "./CreditLimitDialog";
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
  /** At least one of these form fields needs a value (text typed, or a file chosen); pressing the button without one explains what is missing instead of sending. */
  requireOneOf?: string[];
  /** Shown under the disabled button so people know what is missing. */
  requireHint?: string;
  children?: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [filled, setFilled] = useState(!requireOneOf);
  const [tried, setTried] = useState(false);
  const needs = requireOneOf?.join(",");

  /** What is in the form right now, read when it is needed: never trusts an earlier guess, so autofill, dictation or a missed event cannot lock the button. */
  const hasInput = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    return (needs?.split(",") ?? []).some((n) => fd.getAll(n).some((v) => (v instanceof File ? v.size > 0 : v.toString().trim() !== "")));
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!needs || hasInput(e.currentTarget)) return;
    e.preventDefault();
    setTried(true);
    (e.currentTarget.querySelector("textarea, input[type=file]") as HTMLElement | null)?.focus();
  };

  // Re-check after typing, choosing a file, or switching between paste and upload (the active field changes name).
  useEffect(() => {
    const form = formRef.current;
    if (!form || !needs) return;
    const check = () =>
      setTimeout(() => {
        setFilled(hasInput(form));
      }, 0);
    check();
    const events = ["input", "change", "click"] as const;
    events.forEach((e) => form.addEventListener(e, check));
    return () => events.forEach((e) => form.removeEventListener(e, check));
  }, [needs]);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className={className}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <BusyOverlay title={pendingLabel ?? "Working…"} />
      <div className={cn("flex flex-col gap-ds-2", fullWidth ? "items-stretch" : "items-start")}>
        <Submit
          label={label}
          pendingLabel={pendingLabel}
          cost={cost}
          variant={variant}
          className={fullWidth ? "w-full" : undefined}
          describedBy={tried && !filled && requireHint ? "action-hint" : undefined}
        />
        {tried && !filled && requireHint && (
          <p id="action-hint" role="alert" className="text-body-sm text-danger">
            {requireHint}
          </p>
        )}
        <FormMessage state={state} />
      </div>
      {state?.creditStop && <CreditLimitDialog stop={state.creditStop} />}
    </form>
  );
}

function Submit({
  label,
  pendingLabel,
  cost,
  variant,
  className,
  describedBy,
}: {
  label: string;
  pendingLabel?: string;
  cost?: number;
  variant: "primary" | "secondary";
  className?: string;
  describedBy?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      className={className}
      disabled={pending}
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
  if (state.creditStop) return null; // the credit-limit window says it
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
