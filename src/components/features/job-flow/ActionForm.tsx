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
  needs,
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
  /**
   * What the form must have before it is sent. `oneOf`: at least one of these fields has a value (text typed, or a file chosen).
   * `all`: each of these fields has a value. Pressing the button without them says what is missing and moves to it, and sends
   * nothing; everything else in the form is optional and never stops it.
   */
  needs?: { oneOf?: { names: string[]; label: string }; all?: Array<{ name: string; label: string }> };
  children?: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  /** Said under the button after a press that was refused; null while nothing is missing. */
  const [problem, setProblem] = useState<string | null>(null);
  const tried = useRef(false);

  /** What is missing from the form right now, read when it is needed: never trusts an earlier guess, so autofill, dictation or a missed event cannot lock the button. */
  const missing = (form: HTMLFormElement): Array<{ label: string; focus: () => void }> => {
    if (!needs) return [];
    const fd = new FormData(form);
    const has = (n: string) => fd.getAll(n).some((v) => (v instanceof File ? v.size > 0 : v.toString().trim() !== ""));
    const field = (n: string) => () => (form.elements.namedItem(n) as HTMLElement | null)?.focus();
    const out: Array<{ label: string; focus: () => void }> = [];
    if (needs.oneOf && !needs.oneOf.names.some(has))
      out.push({ label: needs.oneOf.label, focus: () => (form.querySelector("textarea, input[type=file]") as HTMLElement | null)?.focus() });
    for (const f of needs.all ?? []) if (!has(f.name)) out.push({ label: f.label, focus: field(f.name) });
    return out;
  };
  const sentence = (m: Array<{ label: string }>) => {
    const labels = m.map((x) => x.label);
    const list = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0];
    return `Please add ${list} to continue.`;
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const m = missing(e.currentTarget);
    if (m.length === 0) return;
    e.preventDefault();
    tried.current = true;
    setProblem(sentence(m));
    m[0]!.focus();
  };

  // After a refused press, keep the message true as the person fills things in (typing, choosing a file, switching between paste and upload).
  useEffect(() => {
    const form = formRef.current;
    if (!form || !needs) return;
    const check = () =>
      setTimeout(() => {
        if (!tried.current) return;
        const m = missing(form);
        setProblem(m.length ? sentence(m) : null);
      }, 0);
    const events = ["input", "change", "click"] as const;
    events.forEach((e) => form.addEventListener(e, check));
    return () => events.forEach((e) => form.removeEventListener(e, check));
    // `missing` and `sentence` only read `needs`, which is what this depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(needs)]);

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
          describedBy={problem ? "action-hint" : undefined}
        />
        {problem && (
          <p id="action-hint" role="alert" className="text-body-sm text-danger">
            {problem}
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
