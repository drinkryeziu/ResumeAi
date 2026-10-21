import type { JobAnalysis, RequirementCategory } from "./workflows/job-analyzer";
import { containsTerm } from "./text";

/**
 * Deterministic scoring. The model only classifies each requirement (strong / partial / missing)
 * and cites evidence; these functions turn that into percentages with fixed weights, so the same
 * classification always yields the same score and every point can be explained.
 */

/** The three buckets the lists and counts use. Derived from the finer label below. */
export type MatchStatus = "strong" | "partial" | "missing";

/**
 * How well one requirement is met, judged from evidence:
 * strong = clearly meets or exceeds · match = meets with adequate direct evidence · partial = related or transferable
 * · weak = well below or outside what is asked · none = no evidence · unknown = not enough information to judge.
 */
export const MATCH_LABELS = ["strong", "match", "partial", "weak", "none", "unknown"] as const;
export type MatchLabel = (typeof MATCH_LABELS)[number];

export const LABEL_TEXT: Record<MatchLabel, string> = {
  strong: "Strong match",
  match: "Match",
  partial: "Partial match",
  weak: "Weak match",
  none: "No evidence",
  unknown: "Cannot determine",
};

/** What each label is worth in the score. "Cannot determine" is not a failure, so it earns a little. */
export const LABEL_VALUE: Record<MatchLabel, number> = { strong: 1, match: 0.9, partial: 0.55, weak: 0.2, none: 0, unknown: 0.3 };

export const statusOfLabel = (l: MatchLabel): MatchStatus => (l === "strong" || l === "match" ? "strong" : l === "none" ? "missing" : "partial");

export interface RequirementAssessment {
  requirementId: string;
  status: MatchStatus;
  /** Absent on matches saved before labels existed. */
  label?: MatchLabel;
  evidenceIds: string[];
  explanation: string;
  /** For requirements measured in years: what the dates add up to (computed in code, overlaps counted once). */
  requiredYears?: number | null;
  qualifyingYears?: number | null;
  relatedYears?: number | null;
  qualifyingRoleIds?: string[];
  relatedRoleIds?: string[];
}

/** The label of an assessment, also for matches saved before labels existed. */
export const labelOf = (a: Pick<RequirementAssessment, "status" | "label">): MatchLabel => a.label ?? (a.status === "strong" ? "strong" : a.status === "partial" ? "partial" : "none");

export const MATCH_CATEGORIES = ["skills", "experience", "keywords", "education", "tools", "industry"] as const;
export type MatchCategory = (typeof MATCH_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<MatchCategory, string> = {
  skills: "Skills match",
  experience: "Experience match",
  keywords: "Keyword match",
  education: "Education match",
  tools: "Tools & technology",
  industry: "Industry match",
};

const CATEGORY_OF: Record<RequirementCategory, Exclude<MatchCategory, "keywords">> = {
  skill: "skills",
  soft_skill: "skills",
  technical: "skills",
  tool: "tools",
  experience: "experience",
  leadership: "experience",
  collaboration: "experience",
  education: "education",
  certification: "education",
  domain: "industry",
};

const CATEGORY_WEIGHT: Record<MatchCategory, number> = {
  skills: 0.3,
  experience: 0.25,
  keywords: 0.15,
  tools: 0.15,
  education: 0.1,
  industry: 0.05,
};

const IMPORTANCE_WEIGHT = { required: 2, preferred: 1 } as const;
const KEYWORD_WEIGHT = { high: 3, medium: 2, low: 1 } as const;

export function keywordCoverage(analysis: JobAnalysis, text: string) {
  const covered: string[] = [];
  const missing: string[] = [];
  let got = 0;
  let total = 0;
  for (const k of analysis.keywords) {
    const w = KEYWORD_WEIGHT[k.importance];
    total += w;
    if (containsTerm(text, k.term)) {
      got += w;
      covered.push(k.term);
    } else missing.push(k.term);
  }
  return { score: total ? Math.round((got / total) * 100) : 100, covered, missing };
}

export interface MatchScores {
  overall: number;
  categories: Record<MatchCategory, number | null>; // null = the job has no requirements in this category
}

export function scoreMatch(analysis: JobAnalysis, assessments: RequirementAssessment[], profileText: string): MatchScores {
  const value = new Map(assessments.map((a) => [a.requirementId, LABEL_VALUE[labelOf(a)]]));
  const acc: Record<string, { got: number; total: number }> = {};
  for (const r of analysis.requirements) {
    const cat = CATEGORY_OF[r.category];
    const w = IMPORTANCE_WEIGHT[r.importance];
    acc[cat] ??= { got: 0, total: 0 };
    acc[cat].total += w;
    acc[cat].got += w * (value.get(r.id) ?? 0);
  }
  const categories = Object.fromEntries(
    MATCH_CATEGORIES.map((c) => {
      if (c === "keywords") return [c, analysis.keywords.length ? keywordCoverage(analysis, profileText).score : null];
      const a = acc[c];
      return [c, a && a.total ? Math.round((a.got / a.total) * 100) : null];
    }),
  ) as Record<MatchCategory, number | null>;

  let weighted = 0;
  let weights = 0;
  for (const c of MATCH_CATEGORIES) {
    const v = categories[c];
    if (v === null) continue;
    weighted += v * CATEGORY_WEIGHT[c];
    weights += CATEGORY_WEIGHT[c];
  }
  return { overall: weights ? Math.round(weighted / weights) : 0, categories };
}

/** Months covered by these roles; overlapping roles are not double-counted. */
export function unionMonths(experiences: Array<{ startDate: string; endDate?: string | null; isCurrent: boolean }>, now = new Date()): number {
  const toMonth = (d: string) => {
    const [y, m] = d.split("-").map(Number);
    return (y ?? 0) * 12 + ((m ?? 1) - 1);
  };
  const nowM = now.getFullYear() * 12 + now.getMonth();
  const spans = experiences
    .map((e) => [toMonth(e.startDate), e.isCurrent || !e.endDate ? nowM : toMonth(e.endDate)] as const)
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && s > 0 && e >= s)
    // Both the start month and the end month are worked months: Jan 2010 – Dec 2012 is 36 months. Spans are half-open, so
    // a job that starts the month after another ends joins it with no gap.
    .map(([s, e]) => [s, e + 1] as const)
    .sort((a, b) => a[0] - b[0]);
  let months = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, e] of spans) {
    if (s > curEnd) {
      if (curEnd >= 0) months += curEnd - curStart;
      curStart = s;
      curEnd = e;
    } else curEnd = Math.max(curEnd, e);
  }
  if (curEnd >= 0) months += curEnd - curStart;
  return months;
}

/** Years of experience from month-precision dates; overlapping roles are not double-counted. */
export function totalYears(experiences: Array<{ startDate: string; endDate?: string | null; isCurrent: boolean }>, now = new Date()): number {
  return Math.round((unionMonths(experiences, now) / 12) * 10) / 10;
}
