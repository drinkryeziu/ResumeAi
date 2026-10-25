"use client";

import { useState, useTransition } from "react";
import { setApplied } from "@/app/(app)/jobs/actions";
import { formatDate } from "@/lib/format";

/**
 * "Applied": the person ticks it after they have sent the application on the employer's site. It is only a note for them;
 * KRZ Resume AI never applies for anyone. The tick shows at once and is put back if saving fails.
 */
export function AppliedCheckbox({ jobId, company, appliedAt }: { jobId: string; company: string; appliedAt: string | null }) {
  const [at, setAt] = useState<string | null>(appliedAt);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const checked = at !== null;
  const toggle = (next: boolean) => {
    const before = at;
    setFailed(false);
    setAt(next ? new Date().toISOString() : null);
    start(async () => {
      try {
        if (!(await setApplied(jobId, next))) throw new Error("not saved");
      } catch {
        setAt(before);
        setFailed(true);
      }
    });
  };
  return (
    <div className="flex flex-col items-end gap-0.5">
      <label className="inline-flex cursor-pointer items-center gap-ds-2 text-body-sm text-navy-900">
        <span>Applied</span>
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
          aria-label={`I applied to ${company}`}
          className="size-5 shrink-0 cursor-pointer accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        />
      </label>
      {failed ? (
        <span role="alert" className="text-caption text-danger">
          Couldn&apos;t save. Try again.
        </span>
      ) : (
        checked && (
          // The date is shown in the reader's own time zone, which the server cannot know.
          <span className="text-caption" suppressHydrationWarning>
            {formatDate(new Date(at))}
          </span>
        )
      )}
    </div>
  );
}
