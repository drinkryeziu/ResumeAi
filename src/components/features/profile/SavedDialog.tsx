"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Confirms a saved profile, then moves on to the dashboard by itself after a short pause.
 * A native <dialog> gives the focus trap and Escape handling; closing it in any way goes to the dashboard.
 */
export function SavedDialog({ open, updatedDocuments, delayMs = 2500 }: { open: boolean; updatedDocuments: boolean; delayMs?: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    const t = setTimeout(() => router.push("/dashboard"), delayMs);
    return () => clearTimeout(t);
  }, [open, delayMs, router]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="saved-title"
      aria-describedby="saved-body"
      onClose={() => router.push("/dashboard")}
      className="m-auto w-[min(440px,calc(100%-32px))] rounded-md bg-white p-ds-5 text-navy-900 shadow-card backdrop:bg-navy-900/50"
    >
      <div className="flex flex-col items-center gap-ds-4 text-center">
        <CheckCircle2 size={40} className="text-success" aria-hidden="true" />
        <div className="flex flex-col gap-ds-2">
          <h2 id="saved-title" className="text-heading-section">
            Profile saved
          </h2>
          <p id="saved-body" role="status" className="text-body">
            {updatedDocuments ? "Your changes are saved and your Master documents are updated. " : "Your changes are saved. "}
            Taking you to the dashboard…
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
          Go to dashboard now
        </Button>
      </div>
    </dialog>
  );
}
