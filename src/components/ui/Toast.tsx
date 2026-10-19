"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";

type ToastItem = { id: number; message: string };
type Show = (message: string) => void;

const ToastContext = createContext<Show>(() => {});

/** Shows a short confirmation. Safe to call anywhere under <ToastProvider>; outside it, it does nothing. */
export const useToast = () => useContext(ToastContext);

const VISIBLE_MS = 5000;

/**
 * Confirmation toasts: bottom of the screen, announced politely to screen readers, gone after a few seconds
 * (or when dismissed). Hovering or focusing a toast keeps it on screen.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const show = useCallback<Show>((message) => {
    const id = next.current++;
    setItems((cur) => [...cur.filter((t) => t.message !== message).slice(-2), { id, message }]);
  }, []);
  const remove = useCallback((id: number) => setItems((cur) => cur.filter((t) => t.id !== id)), []);
  const api = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-ds-4 z-[60] flex flex-col items-center gap-ds-2 px-ds-4">
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDone={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => onDone(item.id), VISIBLE_MS);
    return () => clearTimeout(t);
  }, [paused, item.id, onDone]);
  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="toast-in pointer-events-auto flex max-w-md items-center gap-ds-3 rounded-md bg-navy-900 py-ds-3 pr-ds-2 pl-ds-4 text-body-sm text-white shadow-card"
    >
      <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />
      <span>{item.message}</span>
      <button type="button" onClick={() => onDone(item.id)} aria-label="Dismiss" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/15">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
