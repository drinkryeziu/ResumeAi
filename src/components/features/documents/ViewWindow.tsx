"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";

/**
 * A document opened for reading, in a window over the Documents page. It opens as soon as it is rendered (the page renders it
 * for `?view=<id>`), so the address can be shared and the back button works; closing it returns to `closeHref`.
 * A native <dialog> gives the focus trap, Escape and focus return.
 */
export function ViewWindow({ title, subtitle, editHref, closeHref, children }: { title: string; subtitle?: string; editHref: string; closeHref: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);
  const close = () => dialog.current?.close();
  return (
    <dialog
      ref={dialog}
      aria-labelledby="view-window-title"
      onClose={() => router.replace(closeHref, { scroll: false })}
      onClick={(e) => {
        if (e.target === dialog.current) close(); // a click on the dimmed backdrop closes
      }}
      className="m-auto max-h-[92vh] w-[min(820px,calc(100%-24px))] overflow-y-auto rounded-md bg-sky-50 p-0 text-navy-900 shadow-card backdrop:bg-navy-900/50"
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-ds-4 gap-y-ds-2 bg-sky-50 px-ds-4 py-ds-3 sm:px-ds-5">
        <div className="min-w-0">
          <h2 id="view-window-title" className="text-heading-section">
            {title}
          </h2>
          {subtitle && <p className="text-body-sm">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-ds-2">
          <ButtonLink href={editHref} variant="secondary" compact icon={<PenLine size={16} aria-hidden="true" />}>
            Edit
          </ButtonLink>
          <Button type="button" variant="secondary" compact onClick={close}>
            Close
          </Button>
        </div>
      </div>
      <div className="px-ds-4 pb-ds-4 sm:px-ds-5 sm:pb-ds-5">{children}</div>
    </dialog>
  );
}
