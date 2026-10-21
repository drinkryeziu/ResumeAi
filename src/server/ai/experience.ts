import type { ProfileSnapshot } from "@/server/domain/profile";
import { totalYears, unionMonths, statusOfLabel, type MatchLabel, type RequirementAssessment } from "./scoring";
import type { JobAnalysis, Requirement } from "./workflows/job-analyzer";

/**
 * Experience is arithmetic on the dates in the profile, never something to ask the candidate or to let a model add up.
 * The model only does the judging that needs reading: which roles are the same profession, which are in the same industry,
 * which roles show a skill. This file turns that judging into years (overlapping roles counted once) and into a label.
 */

// ───────────── plain years phrases ─────────────

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

// ───────────── what the model judges about each role ─────────────

export type ProfessionFit = "same" | "related" | "different";
export type IndustryFit = "direct" | "related" | "transferable" | "unrelated";
export type LeadershipKind = "people" | "project" | "none";

/** One role as judged against one job. Titles are never matched by wording alone: this is about the work done. */
export interface RoleTag {
  experienceId: string;
  /** The role's normalized profession ("Product / UX design"), in the model's words. */
  profession: string;
  industry: string;
  professionFit: ProfessionFit;
  industryFit: IndustryFit;
  leadership: LeadershipKind;
}

export interface TitleGroup {
  name: string;
  experienceIds: string[];
  reason: string;
}

export interface ExperienceSummary {
  totalYears: number;
  /** Same profession as the job, whatever the industry. */
  professionYears: number;
  /** The same plus closely related professions. */
  professionRelatedYears: number;
  /** Same industry as the job. */
  industryDirectYears: number;
  /** The same plus closely related industries. */
  industryRelatedYears: number;
  /** Same profession AND same industry (the intersection, not a sum). */
  professionInIndustryYears: number;
  leadershipYears: number;
  roles: Array<RoleTag & { title: string; company: string; years: number }>;
  titleGroups: Array<TitleGroup & { years: number }>;
}

const idsOf = (tags: RoleTag[], keep: (t: RoleTag) => boolean) => tags.filter(keep).map((t) => t.experienceId);

/** Years covered by these roles, overlaps counted once, one decimal. */
export function yearsOfRoles(profile: ProfileSnapshot, ids: string[], now = new Date()): number {
  const set = new Set(ids);
  return Math.round((unionMonths(profile.experiences.filter((e) => set.has(e.id)), now) / 12) * 10) / 10;
}

export function summarizeExperience(profile: ProfileSnapshot, tags: RoleTag[], groups: TitleGroup[], now = new Date()): ExperienceSummary {
  const years = (ids: string[]) => yearsOfRoles(profile, ids, now);
  const own = new Map(tags.map((t) => [t.experienceId, t]));
  return {
    totalYears: totalYears(profile.experiences, now),
    professionYears: years(idsOf(tags, (t) => t.professionFit === "same")),
    professionRelatedYears: years(idsOf(tags, (t) => t.professionFit !== "different")),
    industryDirectYears: years(idsOf(tags, (t) => t.industryFit === "direct")),
    industryRelatedYears: years(idsOf(tags, (t) => t.industryFit === "direct" || t.industryFit === "related")),
    professionInIndustryYears: years(idsOf(tags, (t) => t.professionFit === "same" && t.industryFit === "direct")),
    leadershipYears: years(idsOf(tags, (t) => t.leadership !== "none")),
    roles: profile.experiences.flatMap((e) => {
      const t = own.get(e.id);
      return t ? [{ ...t, title: e.title, company: e.company, years: years([e.id]) }] : [];
    }),
    titleGroups: groups.map((g) => ({ ...g, years: years(g.experienceIds) })),
  };
}

// ───────────── from judged roles to years and a label ─────────────

type Measure = NonNullable<Requirement["measures"]>;

/** Which roles count fully ("direct") and which only partly ("related"), for what the requirement measures. */
export function rolesFor(measure: Measure, tags: RoleTag[], modelDirect: string[], modelRelated: string[]): { direct: string[]; related: string[] } {
  const split = (isDirect: (t: RoleTag) => boolean, isRelated: (t: RoleTag) => boolean) => {
    const direct = idsOf(tags, isDirect);
    return { direct, related: idsOf(tags, (t) => isRelated(t) && !isDirect(t)) };
  };
  switch (measure) {
    case "profession":
      return split((t) => t.professionFit === "same", (t) => t.professionFit === "related");
    case "industry":
      return split((t) => t.industryFit === "direct", (t) => t.industryFit === "related");
    case "profession_industry":
      // Both at once: the intersection. Related counts only where each side is at least related.
      return split(
        (t) => t.professionFit === "same" && t.industryFit === "direct",
        (t) => t.professionFit !== "different" && (t.industryFit === "direct" || t.industryFit === "related"),
      );
    case "leadership":
      return { direct: idsOf(tags, (t) => t.leadership === "people"), related: idsOf(tags, (t) => t.leadership === "project") };
    default:
      return { direct: modelDirect, related: modelRelated.filter((id) => !modelDirect.includes(id)) };
  }
}

/** The label for "N years asked, this many found". `direct` is strict; `all` adds the related roles. */
export function labelForYears(required: number, direct: number, all: number): MatchLabel {
  if (direct >= required * 1.25) return "strong";
  if (direct >= required) return "match";
  if (all >= required || direct >= required * 0.7) return "partial";
  if (all >= required * 0.4 || direct > 0) return "weak";
  return "none";
}

export const fmtYears = (n: number) => (n <= 0 ? "no time" : n < 1 ? "under 1 year" : n === 1 ? "1 year" : `${Number.isInteger(n) ? n : n.toFixed(1)} years`);

const SUBJECT_WORD: Record<string, string> = { profession: "in the same profession", industry: "in the same industry", profession_industry: "in this profession and industry together", skill: "using this skill", leadership: "leading people or projects" };

function describeYears(measure: Measure, required: number, direct: number, all: number, subject: string | null): string {
  const what = subject ? `${subject}` : SUBJECT_WORD[measure];
  const related = Math.round((all - direct) * 10) / 10;
  const base = direct > 0 ? `${fmtYears(direct)} of direct experience (${what})` : `No direct experience (${what})`;
  const extra = related > 0 ? `, plus ${fmtYears(related)} in related roles` : "";
  const verdict = direct >= required ? `The job asks for ${required}.` : all >= required ? `The job asks for ${required}. Counting related experience you reach it, but not on direct experience alone.` : `The job asks for ${required}.`;
  return `${base}${extra}. ${verdict}`;
}

export interface ModelAssessment {
  requirementId: string;
  label: MatchLabel;
  evidenceIds: string[];
  explanation: string;
  qualifyingRoleIds: string[];
  relatedRoleIds: string[];
  /** For a skill or leadership requirement: can the years be established from the dates, or only that it was done? */
  yearsDeterminable: boolean;
}

/**
 * Turns the model's judging into stored assessments. Requirements that measure years are decided here from the dates;
 * all others keep the model's label. Nobody is ever asked how many years they have: the dates already say.
 */
export function groundAssessments(profile: ProfileSnapshot, analysis: JobAnalysis, assessments: ModelAssessment[], tags: RoleTag[], now = new Date()): RequirementAssessment[] {
  const reqs = new Map(analysis.requirements.map((r) => [r.id, r]));
  return assessments.map((a): RequirementAssessment => {
    const r = reqs.get(a.requirementId);
    // Analyses saved before requirements said what they measure: a years phrase in an experience requirement means the profession.
    const textYears = r && r.category === "experience" ? yearsRequired(r.text) : null;
    const measure: Measure = r?.measures && r.measures !== "none" ? r.measures : textYears ? "profession" : "none";
    const required = r?.years ?? textYears;
    const { direct, related } = rolesFor(measure, tags, a.qualifyingRoleIds, a.relatedRoleIds);
    const hasRoles = measure !== "none" && (direct.length > 0 || related.length > 0);

    if (r && required && measure !== "none") {
      const directYears = yearsOfRoles(profile, direct, now);
      const allYears = yearsOfRoles(profile, [...direct, ...related], now);
      // A skill or leadership shown in a role, with no way to tell how long it was used for, is not a number of years.
      if ((measure === "skill" || measure === "leadership") && a.yearsDeterminable === false && hasRoles) {
        return { requirementId: a.requirementId, status: "partial", label: "unknown", evidenceIds: a.evidenceIds, explanation: "Skill demonstrated, but exact years cannot be reliably determined.", requiredYears: required, qualifyingYears: null, relatedYears: null, qualifyingRoleIds: direct, relatedRoleIds: related };
      }
      const label = labelForYears(required, directYears, allYears);
      return {
        requirementId: a.requirementId,
        status: statusOfLabel(label),
        label,
        evidenceIds: label === "none" ? [] : a.evidenceIds.length ? a.evidenceIds : [...direct, ...related].slice(0, 3),
        explanation: describeYears(measure, required, directYears, allYears, r.subject ?? null),
        requiredYears: required,
        qualifyingYears: directYears,
        relatedYears: Math.round((allYears - directYears) * 10) / 10,
        qualifyingRoleIds: direct,
        relatedRoleIds: related,
      };
    }
    return {
      requirementId: a.requirementId,
      status: statusOfLabel(a.label),
      label: a.label,
      evidenceIds: a.evidenceIds,
      explanation: a.explanation,
      ...(hasRoles ? { qualifyingRoleIds: direct, relatedRoleIds: related } : {}),
    };
  });
}

/** Years questions are never asked: dates answer them. Drops any question about a years requirement or that mentions years. */
export function withoutYearsQuestions<Q extends { requirementId: string; question: string }>(analysis: JobAnalysis, questions: Q[]): Q[] {
  const yearsReqs = new Set(analysis.requirements.filter((r) => (r.measures && r.measures !== "none" && r.years) || (r.category === "experience" && yearsRequired(r.text))).map((r) => r.id));
  return questions.filter((q) => !yearsReqs.has(q.requirementId) && yearsMentioned(q.question).length === 0);
}

// ───────────── the candidate on their own (no job): career analysis for the Master Resume ─────────────

export interface CareerAnalysis {
  primaryProfession: string;
  seniority: string;
  totalYears: number;
  byProfession: Array<{ name: string; years: number }>;
  byIndustry: Array<{ name: string; years: number }>;
  /** Each profession inside each industry it was practised in (the intersection, never a sum). */
  byProfessionInIndustry: Array<{ profession: string; industry: string; years: number }>;
  leadershipYears: number;
  titleGroups: Array<TitleGroup & { years: number }>;
  progression: string[];
  strengths: string[];
  differentiators: string[];
  /** Information that would make the resume stronger. Asked for, never invented. */
  gaps: string[];
}

export interface CareerModelOutput {
  primaryProfession: string;
  seniority: string;
  roles: Array<{ experienceId: string; profession: string; industry: string; leadership: LeadershipKind }>;
  titleGroups: TitleGroup[];
  progression: string[];
  strengths: string[];
  differentiators: string[];
  gaps: string[];
}

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The model names each role's profession and industry; the years are added up here from the dates, with overlapping
 * roles counted once. Sentences that state a number the profile does not support are dropped, not repaired.
 */
export function buildCareerAnalysis(profile: ProfileSnapshot, out: CareerModelOutput, now = new Date()): CareerAnalysis {
  const known = new Set(profile.experiences.map((e) => e.id));
  const roles = out.roles.filter((r) => known.has(r.experienceId));
  const total = totalYears(profile.experiences, now);
  const group = (label: (r: (typeof roles)[number]) => string | null) => {
    const names = new Map<string, { name: string; ids: string[] }>();
    for (const r of roles) {
      const name = label(r)?.trim();
      if (!name) continue;
      const g = names.get(key(name)) ?? { name, ids: [] };
      g.ids.push(r.experienceId);
      names.set(key(name), g);
    }
    return [...names.values()];
  };
  const years = (ids: string[]) => yearsOfRoles(profile, ids, now);
  const byYears = <T extends { years: number }>(a: T[]) => a.sort((x, y) => y.years - x.years);
  const claims = (s: string) => yearsMentioned(s).every((n) => n <= Math.floor(total));
  const numbers = new Set((profile.experiences.flatMap((e) => [...e.responsibilities, ...e.achievements]).join(" ") + (profile.summary ?? "")).match(/\d[\d,.]*/g) ?? []);
  const safe = (s: string) => claims(s) && (s.match(/\d[\d,.]*/g) ?? []).every((n) => numbers.has(n) || /^(19|20)\d{2}$/.test(n) || Number(n.replace(/,/g, "")) < 10 || yearsMentioned(s).includes(Number(n)));
  const clean = (a: string[]) => a.map((s) => s.trim()).filter((s) => s && safe(s));

  const inIndustry = new Map<string, { profession: string; industry: string; ids: string[] }>();
  for (const r of roles) {
    const k = `${key(r.profession)}|${key(r.industry)}`;
    const g = inIndustry.get(k) ?? { profession: r.profession.trim(), industry: r.industry.trim(), ids: [] };
    g.ids.push(r.experienceId);
    inIndustry.set(k, g);
  }

  return {
    primaryProfession: out.primaryProfession.trim(),
    seniority: out.seniority.trim(),
    totalYears: total,
    byProfession: byYears(group((r) => r.profession).map((g) => ({ name: g.name, years: years(g.ids) }))),
    byIndustry: byYears(group((r) => r.industry).map((g) => ({ name: g.name, years: years(g.ids) }))),
    byProfessionInIndustry: byYears([...inIndustry.values()].map((g) => ({ profession: g.profession, industry: g.industry, years: years(g.ids) }))),
    leadershipYears: years(roles.filter((r) => r.leadership !== "none").map((r) => r.experienceId)),
    titleGroups: out.titleGroups.filter((g) => g.experienceIds.every((id) => known.has(id))).map((g) => ({ ...g, years: years(g.experienceIds) })),
    progression: clean(out.progression),
    strengths: clean(out.strengths),
    differentiators: clean(out.differentiators),
    gaps: out.gaps.map((s) => s.trim()).filter(Boolean),
  };
}
