import type { ProfileSnapshot } from "@/server/domain/profile";
import { claimableTerms, type EvidenceItem } from "../evidence";
import { experienceYears, yearsMentioned } from "../experience";
import { claimNumbers, normalize } from "../text";

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
