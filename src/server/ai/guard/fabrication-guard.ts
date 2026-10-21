import type { ProfileSnapshot } from "@/server/domain/profile";
import { claimableTerms, type EvidenceItem } from "../evidence";
import { experienceYears, yearsMentioned } from "../experience";
import { claimNumbers, containsTerm, normalize } from "../text";

/**
 * Code-level checks that run on every AI output, whatever the prompt said.
 * Each returns human-readable violations; an empty array means the output is grounded.
 * Violations are fed back to the model once; a second failure refunds credits and stops.
 */

export interface CitedText {
  text: string;
  evidenceIds: string[];
  where: string; // for messages: "summary", "experience exp_1 bullet 2", …
}

/** Every cited id must exist in the evidence index. */
export function unknownEvidence(cited: CitedText[], evidence: EvidenceItem[]): string[] {
  const known = new Set(evidence.map((e) => e.id));
  const out: string[] = [];
  for (const c of cited) {
    if (c.evidenceIds.length === 0) out.push(`${c.where}: no evidence cited — every statement must cite evidence ids.`);
    for (const id of c.evidenceIds) if (!known.has(id)) out.push(`${c.where}: cites unknown evidence id "${id}".`);
  }
  return out;
}

/**
 * Every number that makes a claim (%, $, counts ≥ 10, multipliers) must appear in the text of
 * the evidence it cites. This is what stops "increased conversion by 40%" being invented.
 */
export function inventedNumbers(cited: CitedText[], evidence: EvidenceItem[]): string[] {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const out: string[] = [];
  for (const c of cited) {
    const source = c.evidenceIds.map((id) => byId.get(id)?.text ?? "").join(" ");
    const allowed = new Set(claimNumbers(source));
    for (const n of claimNumbers(c.text)) {
      if (!allowed.has(n)) out.push(`${c.where}: the number "${n}" does not appear in the cited evidence. Remove it or ask the user.`);
    }
  }
  return out;
}

/**
 * "N years" claims may not be longer than the work history adds up to (computed from the dates, overlaps counted once).
 * Shorter claims are fine ("5 years in UX" inside a 12-year career); a figure the cited evidence itself states is accepted.
 */
export function overlongYears(cited: CitedText[], evidence: EvidenceItem[], profile: ProfileSnapshot): string[] {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const total = experienceYears(profile);
  const out: string[] = [];
  for (const c of cited) {
    const stated = new Set(c.evidenceIds.flatMap((id) => (byId.get(id)?.kind === "experience_total" ? [] : yearsMentioned(byId.get(id)?.text ?? ""))));
    for (const n of yearsMentioned(c.text)) {
      if (n > Math.floor(total) && !stated.has(n)) {
        out.push(`${c.where}: "${n} years" is longer than the work history covers (${Math.floor(total) >= 1 ? `${Math.floor(total)}+` : "under 1"} years from the dates). Use that figure or leave years out.`);
      }
    }
  }
  return out;
}

const NOT_A_COMPETENCY = /\d|\b(certified|certification|certificate|degree|bachelor|master of|phd|diploma|license|licence|sdk|api|framework|library|language)\b|\.(js|ts|net|io)\b/i;

/**
 * Skills the candidate never wrote down may be added only when their own words show them: each must cite evidence from the
 * profile and be a competency (team leadership, stakeholder management), never a tool, language, certification or degree.
 */
export function badInferredSkills(items: Array<{ name: string; evidenceIds: string[] }>, profile: ProfileSnapshot, evidence: EvidenceItem[]): string[] {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const listed = claimableTerms(profile);
  const out: string[] = [];
  for (const it of items) {
    const name = it.name.trim();
    if (!name || name.split(/\s+/).length > 6 || name.length > 50) out.push(`inferred skill "${name}": use a short competency name (up to six words).`);
    else if (NOT_A_COMPETENCY.test(name)) out.push(`inferred skill "${name}": only competencies can be inferred, never tools, languages, certifications or degrees.`);
    else if (listed.has(name.toLowerCase())) continue; // already in the profile: nothing inferred
    const real = it.evidenceIds.filter((id) => {
      const k = byId.get(id)?.kind;
      return k === "responsibility" || k === "achievement" || k === "project" || k === "approved_fact" || k === "experience";
    });
    if (real.length === 0) out.push(`inferred skill "${name}": cite the responsibility, achievement or project that shows it.`);
  }
  return out;
}

/** A core competency is a skill the candidate listed, a competency their work shows (and cites), or a supported job term. */
export function unsupportedCompetencies(competencies: string[], inferred: Array<{ name: string }>, profile: ProfileSnapshot, supportedTerms: string[] = []): string[] {
  const allowed = new Set([...claimableTerms(profile), ...inferred.map((s) => s.name.trim().toLowerCase()), ...supportedTerms.map((t) => t.trim().toLowerCase())]);
  return competencies
    .filter((c) => !allowed.has(c.trim().toLowerCase()))
    .map((c) => `core competencies: "${c}" is not in the profile, not an inferred skill with evidence, and not a supported term. Remove it or add it to inferredSkills with the evidence that shows it.`);
}

const SENIOR_TITLE_WORDS = /\b(director|head of|vice president|vp|chief|cto|ceo|cfo|coo|founder|president|executive|manager)\b/i;

/**
 * A vague, company-specific title may be followed by a plain functional equivalent: "Experience Designer III (Product/UX Designer)".
 * The official title is never replaced, and the equivalent may not claim a management or executive level the title does not have.
 */
export function badTitleEquivalents(items: Array<{ experienceId: string; equivalent: string; evidenceIds: string[] }>, profile: ProfileSnapshot): string[] {
  const roles = new Map(profile.experiences.map((e) => [e.id, e]));
  const out: string[] = [];
  for (const it of items) {
    const role = roles.get(it.experienceId);
    const eq = it.equivalent.trim();
    if (!role) out.push(`title equivalent: "${it.experienceId}" is not a role in the profile.`);
    else if (!eq || eq.length > 60 || /\d/.test(eq) || normalize(eq).includes(normalize(role.company))) out.push(`title equivalent "${eq}": keep it short, plain and without numbers or the employer name.`);
    else if (SENIOR_TITLE_WORDS.test(eq) && !SENIOR_TITLE_WORDS.test(role.title)) out.push(`title equivalent "${eq}": it claims a level the official title "${role.title}" does not have.`);
    else if (it.evidenceIds.length === 0 || it.evidenceIds.some((id) => id !== role.id && !id.startsWith(`${role.id}#`))) out.push(`title equivalent "${eq}": cite only evidence from that same role.`);
  }
  return out;
}

/** A job keyword the evidence does not support must not show up in the resume, however much the job wants it. */
export function unsupportedKeywordUse(texts: Array<{ text: string; where: string }>, avoid: string[]): string[] {
  const out: string[] = [];
  for (const t of texts) for (const k of avoid) if (containsTerm(t.text, k)) out.push(`${t.where}: "${k}" is not supported by the candidate's evidence. Remove it.`);
  return out;
}

/** A skill or tool may only be listed if the profile (or an approved answer) contains it. */
export function unsupportedSkills(names: string[], profile: ProfileSnapshot): string[] {
  const allowed = claimableTerms(profile);
  return names
    .filter((n) => !allowed.has(n.trim().toLowerCase()))
    .map((n) => `skills: "${n}" is not in the candidate's profile. Only list skills and tools the profile contains.`);
}

/** Referenced profile rows (experiences, education, certifications, projects) must exist. */
export function unknownRows(kind: string, ids: string[], existing: Array<{ id: string }>): string[] {
  const known = new Set(existing.map((r) => r.id));
  return ids.filter((id) => !known.has(id)).map((id) => `${kind}: "${id}" does not exist in the profile.`);
}

/**
 * Employer, school and certification names must not appear in generated prose unless they are
 * in the profile. Catches a cover letter claiming work at a company the candidate never named.
 * `candidates` is a list of proper names the model mentioned (returned by the workflow).
 */
export function unknownOrganizations(mentioned: string[], profile: ProfileSnapshot, allowAlso: string[] = []): string[] {
  const known = new Set(
    [
      ...profile.experiences.map((e) => e.company),
      ...profile.education.map((e) => e.school),
      ...profile.certifications.flatMap((c) => [c.name, c.issuer ?? ""]),
      ...allowAlso,
    ]
      .filter(Boolean)
      .map(normalize),
  );
  return mentioned.filter((m) => !known.has(normalize(m))).map((m) => `"${m}" is not an organization in the candidate's profile.`);
}
