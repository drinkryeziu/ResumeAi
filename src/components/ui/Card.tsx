import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** radius-md + shadow-card, no hard borders — the design system's card treatment. */
export function Card({ className, ...rest }: ComponentProps<"section">) {
  return <section className={cn("rounded-md bg-white p-ds-4 shadow-card", className)} {...rest} />;
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-ds-4 flex items-start justify-between gap-ds-4">
      <div>
        <h2 className="text-card-title">{title}</h2>
        {subtitle && <p className="mt-ds-1 text-body-sm">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/** sky-50 is the only surface tint in the system. */
export function SoftPanel({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("rounded-md bg-sky-50 p-ds-4", className)} {...rest} />;
}
