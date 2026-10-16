import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { SETUP_STEPS } from "./profile-progress";

/** The four steps of first-time setup. Earlier steps are done, the current one is outlined. */
export function SetupSteps({ current }: { current: number }) {
  return (
    <nav aria-label="Setup progress">
      <ol className="flex flex-wrap items-center gap-x-ds-3 gap-y-ds-3">
        {SETUP_STEPS.map((step, i) => {
          const done = i < current;
          const isCurrent = i === current;
          return (
            <li key={step.key} aria-current={isCurrent ? "step" : undefined} className="flex items-center gap-ds-3">
              <span className="flex items-center gap-ds-2">
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-label-bold",
                    done && "bg-blue-600 text-white",
                    isCurrent && "bg-white text-blue-600 shadow-[inset_0_0_0_2px_var(--blue-600)]",
                    !done && !isCurrent && "bg-gray-100 text-navy-900",
                  )}
                >
                  {done ? <Check size={14} aria-hidden="true" /> : i + 1}
                </span>
                <span className={cn("text-body-sm", isCurrent && "font-bold")}>{step.label}</span>
              </span>
              {i < SETUP_STEPS.length - 1 && <span aria-hidden="true" className={cn("hidden h-0.5 w-6 sm:block", done ? "bg-blue-600" : "bg-gray-100")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
