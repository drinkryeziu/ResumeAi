import "server-only";
import type { InsufficientCreditsError } from "@/server/credits/types";
import { jobProgress } from "@/server/queries/jobs";
import type { AppStore } from "@/server/store/types";

/**
 * What the "you've reached your credit limit" window tells the person. `saved` is read back from the store at that moment,
 * so the window only ever names work that is really there. If the store can't be read, `saveFailed` is set and the window
 * warns instead of claiming anything is safe.
 */
export interface CreditStop {
  required: number;
  available: number;
  saved: string[];
  saveFailed?: boolean;
  /** Where the saved work is, so the person can come back to it. */
  resumeHref: string;
}

export async function describeCreditStop(store: AppStore, userId: string, jobId: string | null, err: Pick<InsufficientCreditsError, "required" | "available">): Promise<CreditStop> {
  const base = { required: err.required, available: err.available };
  if (!jobId) return { ...base, saved: [], resumeHref: "/dashboard" };
  const resumeHref = `/jobs/${jobId}`;
  try {
    const p = await jobProgress(store, userId, jobId);
    if (!p.job) return { ...base, saved: [], saveFailed: true, resumeHref: "/dashboard" };
    const saved = [
      "Your job description",
      ...(p.analysis ? ["The job analysis"] : []),
      ...(p.match ? ["Your Job Match Score"] : []),
      ...(p.resume?.versions.some((v) => v.label === "AI_OPTIMIZED") ? ["Your tailored resume"] : []),
      ...(p.letter ? ["Your cover letter"] : []),
    ];
    return { ...base, saved, resumeHref };
  } catch (e) {
    console.error("[credit-stop] could not read back saved work:", e instanceof Error ? e.message : e);
    return { ...base, saved: [], saveFailed: true, resumeHref: "/dashboard" };
  }
}
