"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { MAX_YEAR, MIN_YEAR, MONTH_LABELS, monthLabel, parseMonthYear } from "@/lib/month";
import { Input } from "./Field";

/**
 * A month-and-year field people can type into ("Mar 2021", "03/2021") or pick from a small calendar.
 * It replaces the browser's own month input, which shows "---------- ----" until you click it.
 * The value stays "YYYY-MM"; text that isn't a real month and year is reported through `onBadText`
 * (and emitted as "") so nothing half-typed is ever saved.
 */
export function MonthField({
  id,
  value,
  onChange,
  onBadText,
  ...rest
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBadText?: (invalid: boolean) => void;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "id">) {
  const [draft, setDraft] = useState(monthLabel(value));
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.slice(0, 4)) || new Date().getFullYear());
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const gridId = useId();

  // Follow outside changes (for example a CV import), but never rewrite what is being typed.
  useEffect(() => {
    if (document.activeElement !== input.current && value !== (parseMonthYear(draft) ?? "")) setDraft(monthLabel(value));
  }, [value, draft]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const pick = (m: number) => {
    const v = `${year}-${String(m + 1).padStart(2, "0")}`;
    setDraft(monthLabel(v));
    onBadText?.(false);
    onChange(v);
    setOpen(false);
    input.current?.focus();
  };
  const selected = parseMonthYear(draft);

  return (
    <div ref={box} className="relative" onKeyDown={(e) => e.key === "Escape" && open && (e.stopPropagation(), setOpen(false), input.current?.focus())}>
      <Input
        {...rest}
        ref={input}
        id={id}
        type="text"
        autoComplete="off"
        placeholder="Month and year"
        value={draft}
        className="pr-11"
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          const v = parseMonthYear(text);
          if (v) setYear(Number(v.slice(0, 4)));
          onBadText?.(false);
          onChange(v ?? "");
        }}
        onBlur={() => {
          const v = parseMonthYear(draft);
          if (v) setDraft(monthLabel(v)); // tidy "march 2021" into "Mar 2021"
          onBadText?.(!v && draft.trim() !== "");
        }}
      />
      <button
        type="button"
        aria-label="Choose month and year"
        aria-expanded={open}
        aria-controls={gridId}
        onClick={() => setOpen((o) => !o)}
        className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-full text-blue-600 hover:bg-white"
      >
        <CalendarDays size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={gridId}
          role="dialog"
          aria-label="Choose month and year"
          className="absolute top-full left-0 z-30 mt-ds-1 w-[260px] max-w-[calc(100vw-32px)] rounded-md bg-white p-ds-3 shadow-card"
        >
          <div className="mb-ds-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous year"
              disabled={year <= MIN_YEAR}
              onClick={() => setYear((y) => y - 1)}
              className="grid size-9 place-items-center rounded-full hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <span className="text-label-bold" aria-live="polite">
              {year}
            </span>
            <button
              type="button"
              aria-label="Next year"
              disabled={year >= MAX_YEAR}
              onClick={() => setYear((y) => y + 1)}
              className="grid size-9 place-items-center rounded-full hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MONTH_LABELS.map((label, m) => {
              const on = selected === `${year}-${String(m + 1).padStart(2, "0")}`;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pick(m)}
                  className={cn("rounded-sm py-2 text-body-sm", on ? "bg-blue-600 font-bold text-white" : "hover:bg-sky-50 hover:text-blue-700")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
