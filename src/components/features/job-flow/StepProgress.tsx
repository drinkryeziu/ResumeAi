import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** The four steps of the job flow: Add job → Job match → Create application → Review & download. */
export const JOB_FLOW_STEPS = [
  { key: "add", label: "Add job", path: null },
  { key: "match", label: "Job match", path: "/match" },
  { key: "create", label: "Create application", path: "/match#create" },
  { key: "review", label: "Review & download", path: "" },
] as const;

export type JobFlowStepKey = (typeof JOB_FLOW_STEPS)[number]["key"];

export function StepProgress({ current, jobId, completed }: { current: JobFlowStepKey; jobId?: string; completed: JobFlowStepKey[] }) {
  const currentIndex = JOB_FLOW_STEPS.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Progress" className="mb-ds-5">
      <ol className="flex flex-wrap items-center gap-x-ds-3 gap-y-ds-3">
        {JOB_FLOW_STEPS.map((step, i) => {
          const done = completed.includes(step.key);
          const isCurrent = i === currentIndex;
          const href = jobId && step.path !== null && (done || isCurrent) ? `/jobs/${jobId}${step.path}` : null;
          const content = (
            <>
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full text-label-bold",
                  done && "bg-blue-600 text-white",
                  isCurrent && !done && "bg-white text-blue-600 shadow-[inset_0_0_0_2px_var(--blue-600)]",
                  !done && !isCurrent && "bg-gray-100 text-navy-900",
                )}
              >
                {done ? <Check size={14} aria-hidden="true" /> : i + 1}
              </span>
              <span className={cn("text-body-sm", isCurrent && "font-bold")}>{step.label}</span>
            </>
          );
          return (
            <li key={step.key} className="flex items-center gap-ds-3" aria-current={isCurrent ? "step" : undefined}>
              {href ? (
                <Link href={href} className="flex items-center gap-ds-2 no-underline">
                  {content}
                </Link>
              ) : (
                <span className="flex items-center gap-ds-2">{content}</span>
              )}
              {i < JOB_FLOW_STEPS.length - 1 && <span aria-hidden="true" className={cn("h-0.5 w-8", done ? "bg-blue-600" : "bg-gray-100")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
