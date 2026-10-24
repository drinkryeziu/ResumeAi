"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";

const WIDTH = 320;
const GAP = 8;
const MARGIN = 16;

/**
 * A small help icon. Pressing it opens a short explanation under it (press again, press outside, scroll or Escape to close). The
 * explanation is placed on the screen, so it never runs off the edge on a phone. `label` names what it explains, for screen readers.
 */
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  const show = () => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(WIDTH, window.innerWidth - MARGIN * 2);
    const left = Math.max(MARGIN, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - MARGIN - width));
    setPos({ top: r.bottom + GAP, left, width });
    setOpen(true);
  };
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) hide();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hide();
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => (open ? hide() : show())}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className="inline-grid size-6 shrink-0 place-items-center rounded-full text-blue-600 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <CircleHelp size={18} aria-hidden="true" />
      </button>
      {open && pos && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={label}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed z-50 rounded-md bg-white p-ds-3 text-left text-body-sm font-normal text-navy-900 shadow-[0_20px_50px_-12px_rgba(50,25,150,0.45)] ring-1 ring-[#e6defa]"
        >
          {children}
        </div>
      )}
    </>
  );
}
