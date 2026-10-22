"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { allOpen, initialOpen, noneOpen, setAllSections, toggleSection, type OpenSections } from "./section-state";

const Ctx = createContext<{ open: OpenSections; toggle: (id: string) => void } | null>(null);

/** Holds which profile sections are open. `ids` lists every section on the page, in reading order: the first starts open, the rest closed. */
export function ProfileSections({ ids, children }: { ids: readonly string[]; children: ReactNode }) {
  const [open, setOpen] = useState<OpenSections>(() => initialOpen(ids));
  const toggle = (id: string) => setOpen((o) => toggleSection(o, id));
  const all = allOpen(open, ids);
  const none = noneOpen(open, ids);
  const bulk = "text-body-sm text-blue-700 underline disabled:cursor-not-allowed disabled:text-gray-500 disabled:no-underline";
  return (
    <Ctx.Provider value={{ open, toggle }}>
      <div className="mb-ds-4 flex items-center gap-ds-3" role="group" aria-label="Show or hide all sections">
        <button type="button" className={bulk} disabled={all} onClick={() => setOpen(setAllSections(ids, true))}>
          Expand all
        </button>
        <span aria-hidden="true" className="text-gray-400">
          |
        </span>
        <button type="button" className={bulk} disabled={none} onClick={() => setOpen(setAllSections(ids, false))}>
          Collapse all
        </button>
      </div>
      {children}
    </Ctx.Provider>
  );
}

/**
 * One profile section: a card whose header is a button that opens and closes it. The title always stays; the body is hidden
 * from sight, from the keyboard and from screen readers while closed, and opens with a short height transition.
 */
export function ProfileSection({
  id,
  title,
  subtitle,
  children,
  className,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(Ctx);
  const uid = useId();
  if (!ctx) throw new Error("ProfileSection must be inside ProfileSections");
  const expanded = ctx.open.has(id);
  return (
    <Card aria-labelledby={`${uid}-h`} className={className}>
      <h2 id={`${uid}-h`} className="text-card-title">
        <button
          type="button"
          onClick={() => ctx.toggle(id)}
          aria-expanded={expanded}
          aria-controls={`${uid}-body`}
          className="flex w-full items-center justify-between gap-ds-3 rounded-sm text-left hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          <span>{title}</span>
          <ChevronDown
            size={20}
            aria-hidden="true"
            className={cn("shrink-0 text-blue-600 transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")}
          />
        </button>
      </h2>
      <div
        id={`${uid}-body`}
        inert={!expanded}
        className={cn("grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-ds-4">
            {subtitle && <p className="mb-ds-4 text-body-sm">{subtitle}</p>}
            {children}
          </div>
        </div>
      </div>
    </Card>
  );
}
