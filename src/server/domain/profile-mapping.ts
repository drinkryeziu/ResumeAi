import type { z } from "zod/v4";
import { normalizeUrl } from "@/lib/url";
import { ANSWER_KEYS, compactAnswers } from "./application-answers";
import type { ProfileSnapshot, SkillCategory } from "./profile";
import type { ProfileInput, ProfileInputSchema } from "./profile-schema";

/** Form shape ↔ ProfileSnapshot. Skills and extras are grouped lists in the form, rows in the profile. */

const SKILL_CATS: SkillCategory[] = ["PROFESSIONAL", "TECHNICAL", "TOOL", "DOMAIN", "SOFT"];
const EXTRA_KINDS = ["LANGUAGE", "AWARD", "PUBLICATION", "VOLUNTEER"] as const;
const n = (s?: string | null) => (s && s.trim() ? s.trim() : null);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "x";

export function toProfileSnapshot(profileId: string, input: z.output<typeof ProfileInputSchema>, approvedFacts: ProfileSnapshot["approvedFacts"]): ProfileSnapshot {
  const seen = new Set<string>();
  return {
    id: profileId,
    firstName: input.firstName,
    lastName: input.lastName,
    headline: input.headline,
    email: input.email,
    phone: n(input.phone),
    city: n(input.city),
    state: n(input.state),
    country: n(input.country),
    summary: n(input.summary),
    links: Object.fromEntries(Object.entries(input.links).filter(([, v]) => v)) as ProfileSnapshot["links"],
    experiences: input.experiences.map((e) => ({ ...e, location: n(e.location), endDate: e.isCurrent ? null : n(e.endDate) })),
    education: input.education.map((e) => ({ ...e, degree: n(e.degree), field: n(e.field), startDate: n(e.startDate), endDate: n(e.endDate), description: n(e.description) })),
    // Skill ids are derived from the name, so the same skill keeps the same evidence id across saves.
    skills: SKILL_CATS.flatMap((category) =>
      input.skills[category]
        .filter((name) => !seen.has(name.toLowerCase()) && seen.add(name.toLowerCase()))
        .map((name) => ({ id: `sk_${slug(name)}${category.slice(0, 2).toLowerCase()}`, name, category })),
    ),
    certifications: input.certifications.map((c) => ({ ...c, issuer: n(c.issuer), issueDate: n(c.issueDate), expiryDate: n(c.expiryDate), credentialId: n(c.credentialId), url: n(c.url) })),
    projects: input.projects.map((p) => ({ ...p, description: n(p.description), role: n(p.role), results: n(p.results) })),
    extras: EXTRA_KINDS.flatMap((kind) => input.extras[kind].map((title, i) => ({ id: `x_${kind.slice(0, 3).toLowerCase()}${i}`, kind, title, detail: null }))),
    approvedFacts,
    application: compactAnswers(input.application),
  };
}

export function toProfileInput(p: ProfileSnapshot | null, fallbackEmail: string, fallbackName: string): ProfileInput {
  const [first = "", ...rest] = fallbackName.split(" ");
  return {
    firstName: p?.firstName ?? first,
    lastName: p?.lastName ?? rest.join(" "),
    headline: p?.headline ?? "",
    email: p?.email ?? fallbackEmail,
    phone: p?.phone ?? "",
    city: p?.city ?? "",
    state: p?.state ?? "",
    country: p?.country ?? "",
    summary: p?.summary ?? "",
    links: {
      linkedin: p?.links.linkedin ?? "",
      portfolio: p?.links.portfolio ?? "",
      github: p?.links.github ?? "",
      behance: p?.links.behance ?? "",
      dribbble: p?.links.dribbble ?? "",
      website: p?.links.website ?? "",
    },
    experiences: (p?.experiences ?? []).map((e) => ({ ...e, location: e.location ?? "", endDate: e.endDate ?? "" })),
    education: (p?.education ?? []).map((e) => ({ id: e.id, school: e.school, degree: e.degree ?? "", field: e.field ?? "", startDate: e.startDate ?? "", endDate: e.endDate ?? "", description: e.description ?? "" })),
    skills: Object.fromEntries(SKILL_CATS.map((c) => [c, (p?.skills ?? []).filter((s) => s.category === c).map((s) => s.name)])) as ProfileInput["skills"],
    certifications: (p?.certifications ?? []).map((c) => ({ id: c.id, name: c.name, issuer: c.issuer ?? "", issueDate: c.issueDate ?? "", expiryDate: c.expiryDate ?? "", credentialId: c.credentialId ?? "", url: c.url ?? "" })),
    projects: (p?.projects ?? []).map((x) => ({ id: x.id, name: x.name, description: x.description ?? "", role: x.role ?? "", tools: x.tools, results: x.results ?? "" })),
    extras: Object.fromEntries(EXTRA_KINDS.map((k) => [k, (p?.extras ?? []).filter((x) => x.kind === k).map((x) => x.title)])) as ProfileInput["extras"],
    application: Object.fromEntries(ANSWER_KEYS.map((k) => [k, p?.application?.[k] ?? ""])),
  };
}

// ───────────── CV import: merge a parsed CV into the profile form, never overwriting ─────────────

type Draft = import("@/server/ai/workflows/resume-parser").ProfileDraft;
const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const same = (a?: string | null, b?: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export interface ImportSummary {
  experiences: number;
  education: number;
  skills: number;
  certifications: number;
  projects: number;
  /** Jobs whose CV dates had no month (e.g. "2020 – Present"): the user must add it. */
  missingStart: string[];
}

/**
 * Pre-fills the profile form from a parsed CV. Existing values win: empty fields are filled, and
 * jobs / schools / certifications / projects / skills are only ADDED when not already present.
 * Bullets with a number or % become achievements; the rest become responsibilities.
 */
export function mergeDraftIntoInput(base: ProfileInput, d: Draft): { input: ProfileInput; added: ImportSummary } {
  const fill = (cur: string | undefined, v: string | null) => (cur && cur.trim() ? cur : (v ?? ""));
  const [city = "", state = "", country = ""] = (d.location ?? "").split(/\s*,\s*/);
  const linkKey = (label: string, url: string) => (/linkedin/i.test(url) ? "linkedin" : /github/i.test(url) ? "github" : /behance/i.test(url) ? "behance" : /dribbble/i.test(url) ? "dribbble" : /portfolio/i.test(label) ? "portfolio" : "website");
  const links = { ...base.links };
  for (const l of d.links) {
    const k = linkKey(l.label, l.url) as keyof typeof links;
    if (!links[k]) links[k] = normalizeUrl(l.url);
  }

  const newExp = d.experiences
    .filter((e) => !base.experiences.some((x) => same(x.company, e.company) && same(x.title, e.title)))
    .map((e) => ({
      id: rid("exp"),
      company: e.company,
      title: e.title,
      location: e.location ?? "",
      startDate: e.startDate ?? "",
      endDate: e.endDate ?? "",
      isCurrent: e.isCurrent,
      achievements: e.bullets.filter((b) => /\d/.test(b)),
      responsibilities: e.bullets.filter((b) => !/\d/.test(b)),
      tools: e.tools,
    }));
  const newEdu = d.education
    .filter((e) => !base.education.some((x) => same(x.school, e.school)))
    .map((e) => ({ id: rid("edu"), school: e.school, degree: e.degree ?? "", field: e.field ?? "", startDate: "", endDate: e.endDate ?? "", description: "" }));
  const newCert = d.certifications
    .filter((c) => !base.certifications.some((x) => same(x.name, c.name)))
    .map((c) => ({ id: rid("cert"), name: c.name, issuer: c.issuer ?? "", issueDate: c.issueDate ?? "", expiryDate: "", credentialId: "", url: "" }));
  const newProj = d.projects
    .filter((p) => !base.projects.some((x) => same(x.name, p.name)))
    .map((p) => ({ id: rid("proj"), name: p.name, description: p.description ?? "", role: "", tools: [], results: "" }));

  const skills = { ...base.skills, PROFESSIONAL: [...base.skills.PROFESSIONAL], TECHNICAL: [...base.skills.TECHNICAL], TOOL: [...base.skills.TOOL], DOMAIN: [...base.skills.DOMAIN], SOFT: [...base.skills.SOFT] };
  const have = new Set(Object.values(skills).flat().map((s) => s.toLowerCase()));
  let skillsAdded = 0;
  for (const s of d.skills) {
    if (have.has(s.name.toLowerCase())) continue;
    skills[s.category].push(s.name);
    have.add(s.name.toLowerCase());
    skillsAdded++;
  }
  const languages = [...base.extras.LANGUAGE, ...d.languages.filter((l) => !base.extras.LANGUAGE.some((x) => same(x, l)))];

  return {
    input: {
      ...base,
      firstName: fill(base.firstName, d.firstName),
      lastName: fill(base.lastName, d.lastName),
      headline: fill(base.headline, d.headline),
      email: fill(base.email, d.email),
      phone: fill(base.phone, d.phone),
      city: fill(base.city, city || null),
      state: fill(base.state, state || null),
      country: fill(base.country, country || null),
      summary: fill(base.summary, d.summary),
      links,
      // a blank placeholder job from an empty form is replaced by the CV's jobs
      experiences: [...base.experiences.filter((e) => e.company || e.title), ...newExp],
      education: [...base.education, ...newEdu],
      certifications: [...base.certifications, ...newCert],
      projects: [...base.projects, ...newProj],
      skills,
      extras: { ...base.extras, LANGUAGE: languages },
    },
    added: {
      experiences: newExp.length,
      education: newEdu.length,
      skills: skillsAdded,
      certifications: newCert.length,
      projects: newProj.length,
      missingStart: newExp.filter((e) => !e.startDate).map((e) => [e.title, e.company].filter(Boolean).join(" at ")),
    },
  };
}
