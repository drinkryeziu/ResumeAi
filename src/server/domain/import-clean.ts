import { normalizeUrl } from "@/lib/url";
import type { ProfileInput } from "./profile-schema";

/**
 * Whatever a CV reader finds, the form it fills in must never be stuck: every value that would break a rule of the profile form
 * (a date that isn't a month, a line longer than the limit, a list that is too long, a link that isn't an address) is made to fit
 * or left out, so the person only has to fix what is really missing. Values that already fit are never changed.
 */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "2019-03", "2019-03-15", "Mar 2019", "March 2019", "03/2019", "3/2019" → "2019-03". A bare year or anything else → "" (the person adds the month). */
export function cleanMonth(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m && +m[2]! >= 1 && +m[2]! <= 12) return `${m[1]}-${m[2]!.padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.](\d{4})$/);
  if (m && +m[1]! >= 1 && +m[1]! <= 12) return `${m[2]}-${m[1]!.padStart(2, "0")}`;
  m = s.match(/^([a-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m) {
    const i = MONTHS.indexOf(m[1]!.slice(0, 3));
    if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, "0")}`;
  }
  return "";
}

/** Cuts text to `max` characters at a sentence end or a space when it can, with no ellipsis: it is the person's own text, shortened. */
export function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  if (sentence > max * 0.5) return cut.slice(0, sentence + 1).trim();
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.5 ? cut.slice(0, space) : cut).trim();
}

/** Lines (one bullet, skill or tool each): long ones are split at sentence ends so nothing is lost, the rest clipped; at most `maxItems`. */
export function cleanLines(lines: readonly string[], maxLen = 400, maxItems = 30): string[] {
  const out: string[] = [];
  for (const line of lines) {
    let rest = line.replace(/\s+/g, " ").trim();
    while (rest.length > maxLen) {
      const head = clip(rest, maxLen);
      out.push(head);
      rest = rest.slice(head.length).trim();
      if (!rest) break;
    }
    if (rest) out.push(rest);
  }
  return out.slice(0, maxItems);
}

const text = (s: string | undefined | null, max: number) => clip(s ?? "", max);
const validUrl = (u: string) => {
  try {
    return /^https?:$/.test(new URL(u).protocol);
  } catch {
    return false;
  }
};

export function cleanImported(input: ProfileInput): ProfileInput {
  const links = Object.fromEntries(
    Object.entries(input.links).map(([k, v]) => {
      const u = normalizeUrl(v ?? "");
      return [k, u && validUrl(u) && u.length <= 500 ? u : ""];
    }),
  ) as ProfileInput["links"];
  return {
    ...input,
    firstName: text(input.firstName, 80),
    lastName: text(input.lastName, 80),
    headline: text(input.headline, 120),
    phone: (input.phone ?? "").trim().length <= 40 ? (input.phone ?? "").trim() : "", // too long to be a phone number: leave it for the person
    city: (input.city ?? "").length <= 80 ? (input.city ?? "") : "",
    state: (input.state ?? "").length <= 80 ? (input.state ?? "") : "",
    country: (input.country ?? "").length <= 80 ? (input.country ?? "") : "",
    summary: text(input.summary, 2000),
    links,
    experiences: input.experiences.slice(0, 25).map((e) => ({
      ...e,
      company: text(e.company, 120),
      title: text(e.title, 120),
      location: text(e.location, 120),
      startDate: cleanMonth(e.startDate),
      endDate: cleanMonth(e.endDate),
      responsibilities: cleanLines(e.responsibilities),
      achievements: cleanLines(e.achievements),
      tools: cleanLines(e.tools),
    })),
    education: input.education.slice(0, 10).map((e) => ({
      ...e,
      school: text(e.school, 160),
      degree: text(e.degree, 120),
      field: text(e.field, 120),
      startDate: cleanMonth(e.startDate),
      endDate: cleanMonth(e.endDate),
      description: text(e.description, 1000),
    })),
    skills: Object.fromEntries(Object.entries(input.skills).map(([k, v]) => [k, cleanLines(v)])) as ProfileInput["skills"],
    certifications: input.certifications.slice(0, 20).map((c) => ({
      ...c,
      name: text(c.name, 160),
      issuer: text(c.issuer, 160),
      issueDate: cleanMonth(c.issueDate),
      expiryDate: cleanMonth(c.expiryDate),
      credentialId: text(c.credentialId, 120),
      url: (() => {
        const u = normalizeUrl(c.url ?? "");
        return u && validUrl(u) && u.length <= 500 ? u : "";
      })(),
    })),
    projects: input.projects.slice(0, 15).map((p) => ({ ...p, name: text(p.name, 160), description: text(p.description, 1500), role: text(p.role, 120), tools: cleanLines(p.tools), results: text(p.results, 1000) })),
    extras: Object.fromEntries(Object.entries(input.extras).map(([k, v]) => [k, cleanLines(v)])) as ProfileInput["extras"],
  };
}
