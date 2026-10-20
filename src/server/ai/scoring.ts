import type { JobAnalysis, RequirementCategory } from "./workflows/job-analyzer";
import { containsTerm } from "./text";

/**
 * Deterministic scoring. The model only classifies each requirement (strong / partial / missing)
 * and cites evidence; these functions turn that into percentages with fixed weights, so the same
 * classification always yields the same score and every point can be explained.
 */

export type MatchStatus = "strong" | "partial" | "missing";

export interface RequirementAssessment {
  requirementId: string;
  status: MatchStatus;
  evidenceIds: string[];
  explanation: string;
}

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

const STATUS_VALUE: Record<MatchStatus, number> = { strong: 1, partial: 0.5, missing: 0 };
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
  const status = new Map(assessments.map((a) => [a.requirementId, a.status]));
  const acc: Record<string, { got: number; total: number }> = {};
  for (const r of analysis.requirements) {
    const cat = CATEGORY_OF[r.category];
    const w = IMPORTANCE_WEIGHT[r.importance];
    acc[cat] ??= { got: 0, total: 0 };
    acc[cat].total += w;
    acc[cat].got += w * STATUS_VALUE[status.get(r.id) ?? "missing"];
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

/** Years of experience from month-precision dates; overlapping roles are not double-counted. */
export function totalYears(experiences: Array<{ startDate: string; endDate?: string | null; isCurrent: boolean }>, now = new Date()): number {
  const toMonth = (d: string) => {
    const [y, m] = d.split("-").map(Number);
    return (y ?? 0) * 12 + ((m ?? 1) - 1);
  };
  const nowM = now.getFullYear() * 12 + now.getMonth();
  const spans = experiences
    .map((e) => [toMonth(e.startDate), e.isCurrent || !e.endDate ? nowM : toMonth(e.endDate)] as const)
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && s > 0 && e >= s)
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
  return Math.round((months / 12) * 10) / 10;
}
