import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-gray-100 text-navy-900",
  info: "bg-sky-50 text-blue-700",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-pill px-ds-2 py-0.5 text-caption font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}
