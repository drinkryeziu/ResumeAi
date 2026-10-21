"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { CreditStop } from "@/server/services/credit-stop";

/**
 * "You've reached your credit limit": shown when a task needs more credits than the person has. It is a pause, not an error:
 * it names the work that is really saved (read back from the store), or warns when that could not be confirmed, and it
 * never claims more than that. It opens once per attempt; closing it does not bring it back until the next attempt.
 * A native <dialog> gives the focus trap, Escape and focus return.
 */
export function CreditLimitDialog({ stop }: { stop: CreditStop }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // `stop` is a new object for every attempt, so this runs once per attempt and not on other renders.
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, [stop]);

  const close = () => dialog.current?.close();
  const later = () => {
    close();
    if (pathname !== stop.resumeHref) router.push(stop.resumeHref);
  };
  const hasSaved = stop.saved.length > 0 && !stop.saveFailed;
  const short = Math.max(0, stop.required - stop.available);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="credit-limit-title"
      aria-describedby="credit-limit-message"
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
      className="m-auto w-[min(480px,calc(100%-32px))] rounded-md bg-white p-ds-5 text-navy-900 shadow-card backdrop:bg-navy-900/50"
    >
      <div className="flex flex-col gap-ds-4">
        <div className="flex items-start justify-between gap-ds-3">
          <h2 id="credit-limit-title" className="text-heading-section">
            You&apos;ve reached your credit limit
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-gray-100">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div id="credit-limit-message" className="flex flex-col gap-ds-2">
          {stop.saveFailed ? (
            <p role="alert" className="text-body">
              <strong>We couldn&apos;t confirm that your work was saved.</strong> Open your applications from the dashboard to check before you leave, and copy anything important.
            </p>
          ) : hasSaved ? (
            <p className="text-body">You&apos;ve used all of your available credits. Your work and progress so far have been saved, so you won&apos;t lose what you&apos;ve already completed.</p>
          ) : (
            <p className="text-body">You&apos;ve used all of your available credits. Nothing you&apos;ve done so far has been changed or lost.</p>
          )}
          <p className="text-body-sm">
            This step needs {stop.required} credits and you have {stop.available}
            {short > 0 ? `, so you need ${short} more` : ""}. Additional credits are required to continue processing this task.
          </p>
        </div>
        {hasSaved && (
          <div>
            <h3 className="text-label-bold mb-ds-1">Saved</h3>
            <ul className="list-disc pl-5 text-body-sm">
              {stop.saved.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-ds-3">
          <Button type="button" variant="secondary" onClick={later}>
            Continue later
          </Button>
          <ButtonLink href={`/credits?from=${encodeURIComponent(stop.resumeHref)}`}>Buy more credits</ButtonLink>
        </div>
      </div>
    </dialog>
  );
}
