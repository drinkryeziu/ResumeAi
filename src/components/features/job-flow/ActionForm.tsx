"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
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
  children?: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <div className={cn("flex flex-col gap-ds-2", fullWidth ? "items-stretch" : "items-start")}>
        <Submit label={label} pendingLabel={pendingLabel} cost={cost} variant={variant} className={fullWidth ? "w-full" : undefined} />
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function Submit({ label, pendingLabel, cost, variant, className }: { label: string; pendingLabel?: string; cost?: number; variant: "primary" | "secondary"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} className={className} disabled={pending} cost={pending ? undefined : cost} icon={pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : undefined}>
      {pending ? (pendingLabel ?? "Working…") : label}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.ok) return <p role="status" className="text-body-sm text-success">{state.ok}</p>;
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
