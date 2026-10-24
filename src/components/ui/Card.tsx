import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The design system's card grounds: white, or one of the pale card tints (cards-*). */
const TONES = {
  white: "bg-white",
  green: "bg-cards-green",
  blue: "bg-cards-blue",
  yellow: "bg-cards-yellow",
  orange: "bg-cards-orange",
  red: "bg-cards-red",
  /** The first page's lilac-to-pink wash, for the one card that should stand out on a page. */
  aurora: "bg-gradient-to-br from-[#efe9ff] to-[#ffe6f3]",
} as const;

/** radius-md + shadow-card, no hard borders — the design system's card treatment. */
export function Card({ className, tone = "white", ...rest }: ComponentProps<"section"> & { tone?: keyof typeof TONES }) {
  return <section className={cn("rounded-md p-ds-4 shadow-card", TONES[tone], className)} {...rest} />;
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
