import type { ProfileSnapshot } from "@/server/domain/profile";
import type { MatchModelOutput } from "./workflows/candidate-match";
import type { JobAnalysis } from "./workflows/job-analyzer";
import { totalYears } from "./scoring";

/**
 * "Years of experience" is arithmetic on the dates in the profile, not something to ask the candidate or let the model
 * guess. This file is the one place that does that arithmetic and applies it to the job match and the guard.
 */

const YEARS_PHRASE = /(\d+(?:\.\d+)?)\s*\+?\s*(?:-|–|to)?\s*(?:\d+\s*)?(?:years?|yrs?)\b/gi;

/** Every "N years" number in a piece of text (the first number of a range like "3-5 years"). */
export function yearsMentioned(text: string): number[] {
  return [...text.matchAll(YEARS_PHRASE)].map((m) => Number(m[1])).filter((n) => Number.isFinite(n));
}

/** The years a requirement asks for ("6+ years of experience in UX"), or null when it names none. */
export function yearsRequired(text: string): number | null {
  const n = yearsMentioned(text)[0];
  return n && n > 0 ? n : null;
}

/** Total professional experience from the work history's dates (overlapping roles counted once). */
export function experienceYears(profile: ProfileSnapshot): number {
  return totalYears(profile.experiences);
}

/** The line the models see, so they never have to add up dates themselves. */
export function experienceFactText(profile: ProfileSnapshot): string | null {
  const years = experienceYears(profile);
  if (profile.experiences.length === 0 || years <= 0) return null;
  const whole = Math.floor(years);
  const safe = whole >= 1 ? `${whole}+ years` : "less than 1 year";
  return `Total professional experience, added up from the dates of all roles with overlaps counted once: ${whole >= 1 ? `${whole} years` : "under 1 year"} (exactly ${years}). It is correct to write "${safe}". Never write a longer span than this`;
}

/**
 * Years requirements are decided from the dates, not by asking. Where the work history covers the years the job asks
 * for, the requirement is met; either way the candidate is never asked a yes/no question about years.
 */
export function groundYearsRequirements(profile: ProfileSnapshot, analysis: JobAnalysis, out: MatchModelOutput): MatchModelOutput {
  const years = experienceYears(profile);
  const yearsReqs = new Map<string, number>();
  for (const r of analysis.requirements) {
    const need = yearsRequired(r.text);
    if (need && r.category === "experience") yearsReqs.set(r.id, need);
  }
  if (yearsReqs.size === 0 && !out.questions.some((q) => yearsMentioned(q.question).length)) return out;

  const expIds = profile.experiences.map((e) => e.id).slice(0, 3);
  const assessments = out.assessments.map((a) => {
    const need = yearsReqs.get(a.requirementId);
    if (!need) return a;
    const ratio = years / need;
    const status = ratio >= 1 ? ("strong" as const) : ratio >= 0.7 ? ("partial" as const) : ("missing" as const);
    const shown = Math.floor(years);
    return {
      requirementId: a.requirementId,
      status,
      evidenceIds: status === "missing" ? [] : expIds,
      explanation: `Your work history adds up to ${shown >= 1 ? `${shown}+` : "under 1"} years.`,
    };
  });
  const questions = out.questions.filter((q) => !yearsReqs.has(q.requirementId) && yearsMentioned(q.question).length === 0);
  return { assessments, questions };
}
