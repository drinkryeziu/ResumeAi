"use client";

import { useLayoutEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

/** 75 → "1:15". */
export function formatElapsed(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Counts up from 0:00. It writes straight into the element instead of using state: while a form action is running,
 * React shows "pending" only for the action's own render, so a state update here would render the form as not pending
 * and close the window.
 */
function Timer() {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (ref.current) ref.current.textContent = formatElapsed((Date.now() - started) / 1000);
    }, 250);
    return () => clearInterval(id);
  }, []);
  return (
    <p ref={ref} className="text-body tabular-nums" aria-hidden="true">
      0:00
    </p>
  );
}

/**
 * A "working" window with a spinner and a running timer, for AI actions that take a while. Render it inside the
 * <form>: it appears while that form is submitting (after a 0.4 s pause so quick actions don't flash it) and covers
 * the page, so nothing can be clicked twice.
 */
export function BusyOverlay({ title, hint = "This usually takes under a minute. Please keep this page open." }: { title: string; hint?: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="busy-in fixed inset-0 z-50 grid place-items-center bg-navy-900/50 p-ds-4">
      <div role="status" aria-live="polite" className="flex w-[min(400px,100%)] flex-col items-center gap-ds-3 rounded-md bg-white p-ds-5 text-center text-navy-900 shadow-card">
        <Loader2 size={36} className="animate-spin text-blue-600" aria-hidden="true" />
        <p className="text-heading-feature">{title}</p>
        <p className="text-body-sm">{hint}</p>
        <Timer />
      </div>
    </div>
  );
}
