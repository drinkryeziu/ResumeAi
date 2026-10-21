"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * "Edit resume" / "Edit cover letter": a text link that opens the editor in a window over the page.
 * `openInitially` opens it straight away (a link with ?mode=edit); closing it then returns to `closeHref`.
 */
export function EditWindow({ label, title, openInitially, closeHref, hideTrigger = false, children }: { label: string; title: string; openInitially: boolean; closeHref: string; hideTrigger?: boolean; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (openInitially && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [openInitially]);
  return (
    <>
      {!hideTrigger && (
        <Button type="button" variant="link" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">
          {label}
        </Button>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="edit-window-title"
        onClose={() => {
          if (openInitially || hideTrigger) router.replace(closeHref, { scroll: false });
        }}
        className="m-auto max-h-[90vh] w-[min(760px,calc(100%-32px))] overflow-y-auto rounded-md bg-white p-0 text-navy-900 shadow-card backdrop:bg-navy-900/50"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-ds-3 bg-white px-ds-5 pt-ds-4 pb-ds-2">
          <h2 id="edit-window-title" className="text-heading-section">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close without saving"
            className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-gray-100"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="px-ds-5 pb-ds-5">{children}</div>
      </dialog>
    </>
  );
}
