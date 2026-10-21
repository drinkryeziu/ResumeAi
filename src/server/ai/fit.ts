import { labelOf, LABEL_VALUE, type MatchLabel, type RequirementAssessment } from "./scoring";
import type { JobAnalysis, Requirement } from "./workflows/job-analyzer";

/**
 * The overall conclusion about how well a candidate fits a job, worked out from the requirement-by-requirement judgments.
 * It is words, not a percentage, and a missing mandatory requirement can never be hidden behind many preferred ones.
 */

export const FIT_LEVELS = ["Excellent fit", "Strong fit", "Good fit", "Partial fit", "Weak fit", "Insufficient evidence"] as const;
export type FitLevel = (typeof FIT_LEVELS)[number];

export const STRENGTHS = ["Strong", "Good", "Partial", "Weak"] as const;
export type Strength = (typeof STRENGTHS)[number];

export interface FitReport {
  overall: FitLevel;
  /** One or two sentences saying why, from the same evidence. */
  reason: string;
  /** Null = the job has no requirements of this kind. */
  mandatory: Strength | null;
  preferred: Strength | null;
  professional: Strength | null;
  industry: Strength | null;
  technical: Strength | null;
  leadership: Strength | null;
  education: Strength | null;
  evidence: Strength | null;
  /** Mandatory requirements that are not met (weak or no evidence). */
  mandatoryGaps: string[];
}

export const DIMENSION_LABELS: Array<[keyof Omit<FitReport, "overall" | "reason" | "mandatoryGaps">, string]> = [
  ["mandatory", "Mandatory requirements"],
  ["preferred", "Preferred qualifications"],
  ["professional", "Professional match"],
  ["industry", "Industry match"],
  ["technical", "Technical match"],
  ["leadership", "Leadership match"],
  ["education", "Education and certifications"],
  ["evidence", "Evidence quality"],
];

const strength = (v: number): Strength => (v >= 0.8 ? "Strong" : v >= 0.6 ? "Good" : v >= 0.35 ? "Partial" : "Weak");

type Row = { req: Requirement; label: MatchLabel; a: RequirementAssessment };

function avg(rows: Row[]): number | null {
  return rows.length ? rows.reduce((s, r) => s + LABEL_VALUE[r.label], 0) / rows.length : null;
}
const band = (rows: Row[]): Strength | null => {
  const v = avg(rows);
  return v === null ? null : strength(v);
};

export function computeFit(analysis: JobAnalysis, assessments: RequirementAssessment[]): FitReport {
  const byId = new Map(assessments.map((a) => [a.requirementId, a]));
  const rows: Row[] = analysis.requirements.flatMap((req) => {
    const a = byId.get(req.id);
    return a ? [{ req, label: labelOf(a), a }] : [];
  });
  const required = rows.filter((r) => r.req.importance === "required");
  const preferred = rows.filter((r) => r.req.importance === "preferred");
  const measures = (r: Row) => r.req.measures ?? "none";
  const professional = rows.filter((r) => measures(r) === "profession" || (measures(r) === "none" && r.req.category === "experience"));
  const industry = rows.filter((r) => measures(r) === "industry" || measures(r) === "profession_industry" || r.req.category === "domain");
  const technical = rows.filter((r) => ["skill", "technical", "tool"].includes(r.req.category) && measures(r) !== "industry");
  const leadership = rows.filter((r) => measures(r) === "leadership" || r.req.category === "leadership");
  const education = rows.filter((r) => r.req.category === "education" || r.req.category === "certification");

  const judged = rows.filter((r) => r.label !== "none");
  const evidenceRows = judged.map((r): Row => ({ ...r, label: r.label === "unknown" || r.a.evidenceIds.length === 0 ? "weak" : "strong" }));

  const gaps = required.filter((r) => r.label === "none" || r.label === "weak").map((r) => r.req.text);
  const noEvidence = required.filter((r) => r.label === "none").length;
  const unknownShare = rows.length ? rows.filter((r) => r.label === "unknown").length / rows.length : 1;
  const mandatoryAvg = avg(required) ?? avg(rows);
  const preferredAvg = avg(preferred);

  let overall: FitLevel;
  let reason: string;
  if (rows.length === 0 || unknownShare >= 0.4) {
    overall = "Insufficient evidence";
    reason = "There isn't enough information in the profile and job description to judge most requirements reliably.";
  } else {
    const m = mandatoryAvg ?? 0;
    if (noEvidence === 0 && gaps.length === 0 && m >= 0.85 && (preferredAvg === null || preferredAvg >= 0.55)) {
      overall = "Excellent fit";
      reason = "Every mandatory requirement is met with direct evidence, and most preferred qualifications are too.";
    } else if (noEvidence === 0 && gaps.length === 0 && m >= 0.7) {
      overall = "Strong fit";
      reason = "All mandatory requirements are met or nearly met, with solid evidence.";
    } else if (noEvidence === 0 && m >= 0.5) {
      overall = "Good fit";
      reason = gaps.length ? "Most mandatory requirements are met, but a few are only weakly supported." : "Most mandatory requirements are met; some are partly met through related experience.";
    } else if (m >= 0.3 || noEvidence <= 1) {
      overall = "Partial fit";
      reason = noEvidence ? `${noEvidence === 1 ? "A mandatory requirement has" : `${noEvidence} mandatory requirements have`} no evidence in the profile.` : "Several mandatory requirements are only partly met.";
    } else {
      overall = "Weak fit";
      reason = "Many mandatory requirements have little or no evidence in the profile.";
    }
  }

  return {
    overall,
    reason,
    mandatory: band(required),
    preferred: band(preferred),
    professional: band(professional),
    industry: band(industry),
    technical: band(technical),
    leadership: band(leadership),
    education: band(education),
    evidence: band(evidenceRows),
    mandatoryGaps: gaps,
  };
}
