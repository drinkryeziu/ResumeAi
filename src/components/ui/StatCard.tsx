import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const TONES = { neutral: "text-blue-600", ok: "text-success", warn: "text-warning", bad: "text-danger" } as const;

/** One number or status with a label, an icon and a line of detail. `tone` colors the icon (and says "ok", "warn" or "bad" for screen readers). */
export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="flex items-start gap-ds-3 rounded-md bg-white p-ds-4 shadow-card">
      <span className={cn("mt-0.5", TONES[tone])} aria-hidden="true">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-ds-1">
        <span className="text-body-sm">{label}</span>
        <span className="text-heading-section">{value}</span>
        {hint && <span className="text-caption">{hint}</span>}
      </div>
    </div>
  );
}
