"use client";

import { createContext, useContext, useId, useState, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { allOpen, initialOpen, noneOpen, setAllSections, toggleSection, type OpenSections } from "./section-state";

const Ctx = createContext<{ open: OpenSections; toggle: (id: string) => void } | null>(null);

/** Holds which profile sections are open. `ids` lists every section on the page, in reading order: the first starts open, the rest closed. */
export function ProfileSections({
  ids,
  alsoOpen = [],
  children,
}: {
  ids: readonly string[];
  /** Sections that start open as well as the first one. */ alsoOpen?: readonly string[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState<OpenSections>(() => new Set([...initialOpen(ids), ...alsoOpen.filter((id) => ids.includes(id))]));
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
  editHref,
  tone,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  /** An "Edit" link beside the chevron that opens this section in the editor. */
  editHref?: string;
  /** A different card colour, for the section that should stand out. */
  tone?: ComponentProps<typeof Card>["tone"];
}) {
  const ctx = useContext(Ctx);
  const uid = useId();
  if (!ctx) throw new Error("ProfileSection must be inside ProfileSections");
  const expanded = ctx.open.has(id);
  return (
    <Card aria-labelledby={`${uid}-h`} className={className} tone={tone}>
      <div className="relative">
        <h3 id={`${uid}-h`} className="text-card-title">
          <button
            type="button"
            onClick={() => ctx.toggle(id)}
            aria-expanded={expanded}
            aria-controls={`${uid}-body`}
            className="flex w-full items-center justify-between gap-ds-3 rounded-sm text-left hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          >
            <span className={editHref ? "pr-[72px]" : undefined}>{title}</span>
            <ChevronDown
              size={20}
              aria-hidden="true"
              className={cn("shrink-0 text-blue-600 transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")}
            />
          </button>
        </h3>
        {editHref && (
          <Link
            href={editHref}
            aria-label={`Edit ${title.toLowerCase()}`}
            className="absolute top-1/2 right-9 inline-flex -translate-y-1/2 items-center gap-1 rounded-pill px-ds-2 py-1 text-body-sm text-blue-700 no-underline hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Pencil size={14} aria-hidden="true" /> Edit
          </Link>
        )}
      </div>
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
