import type { CareerAnalysis } from "@/server/ai/experience";
import type { ProfileSnapshot } from "@/server/domain/profile";

/**
 * What a ResumeVersion stores. Factual fields (company, title, dates, school, degree, cert names)
 * are COPIED from the Master Profile by `assembleResume`; only wording comes from the AI.
 * `sourceId` keeps every section traceable back to its profile row.
 */
export interface ResumeDocument {
  templateId: string;
  header: {
    name: string;
    headline: string;
    email: string;
    phone?: string | null;
    location?: string | null;
    links: Array<{ label: string; url: string }>;
  };
  summary: string;
  experience: Array<{
    sourceId: string;
    company: string;
    title: string;
    location?: string | null;
    startDate: string;
    endDate: string | null; // null = present
    bullets: string[];
  }>;
  /** Core competencies tailored to the job: skills the profile lists or the candidate's own work clearly demonstrates. Absent on older resumes. */
  competencies?: string[];
  /** Technical skills (tools, platforms, methods). Titled just "Skills" on a resume that has no competencies. */
  skills: string[];
  education: Array<{ sourceId: string; school: string; degree?: string | null; field?: string | null; endDate?: string | null }>;
  certifications: Array<{ sourceId: string; name: string; issuer?: string | null; issueDate?: string | null }>;
  projects: Array<{ sourceId: string; name: string; description: string }>;
  /** Languages, awards, publications, volunteer work — copied from the profile as written. */
  additional?: Array<{ heading: string; items: string[] }>;
  /** Master Resume only: what the career adds up to by profession and industry. Not printed on the resume. */
  analysis?: CareerAnalysis;
}

export interface CoverLetterDocument {
  /** `links`: readable LinkedIn / portfolio addresses, when the profile has them. */
  /** `headline`: the job title line under the name, the same as on the resume. Absent on letters written before it existed. */
  sender: { name: string; headline?: string | null; email: string; phone?: string | null; location?: string | null; links?: string[] };
  recipient: { company: string; jobTitle: string };
  date: string; // ISO date
  greeting: string;
  paragraphs: string[];
  closing: string;
  signature: string;
}

export interface ResumeDraft {
  headline: string;
  summary: string;
  experiences: Array<{ experienceId: string; bullets: string[] }>;
  skills: string[];
  competencies?: string[];
  educationIds: string[];
  certificationIds: string[];
  projects: Array<{ projectId: string; description: string }>;
  /** Plain functional equivalents of vague official titles, by role id. The official title is always kept. */
  titleEquivalents?: Record<string, string>;
}

const LINK_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  portfolio: "Portfolio",
  github: "GitHub",
  behance: "Behance",
  dribbble: "Dribbble",
  website: "Website",
};

/**
 * Links are printed as readable URLs ("linkedin.com/in/alex"), not just a label: an ATS reads the
 * visible text and usually ignores the hyperlink behind it.
 */
export const displayUrl = (url: string) => url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

/**
 * The cover letter's top block, the same order as the resume's header: name, job title, phone and email, city and state, links.
 * Empty lines are left out. Nothing missing is invented.
 */
export function senderLines(s: CoverLetterDocument["sender"]) {
  return {
    name: s.name,
    headline: s.headline ?? "",
    contact: [s.phone, s.email].filter(Boolean).join(HEADER_SEPARATOR),
    place: s.location ?? "",
    links: s.links ?? [],
  };
}

/** "Cornelius, NC" for the resume header: city and state, or the city and country when there is no state, or just what there is. */
export function cityStateOf(p: Pick<ProfileSnapshot, "city" | "state" | "country">) {
  const parts = p.city && !p.state && p.country ? [p.city, p.country] : [p.city, p.state];
  return parts.filter(Boolean).join(", ") || p.country || null;
}

/**
 * The resume header, one fact per line in this order: name, job title, phone and email, city and state, then the links.
 * Empty lines are left out. Every renderer (preview, PDF, Word, plain text) uses this, so they never disagree.
 */
export const HEADER_SEPARATOR = "  |  ";
export function headerLines(h: ResumeDocument["header"]) {
  return {
    name: h.name,
    headline: h.headline,
    contact: [h.phone, h.email].filter(Boolean).join(HEADER_SEPARATOR),
    place: h.location ?? "",
    links: h.links.map((l) => ({ label: l.label, url: l.url, text: displayUrl(l.url) })),
  };
}

export function locationOf(p: Pick<ProfileSnapshot, "city" | "state" | "country">) {
  return [p.city, p.state, p.country].filter(Boolean).join(", ") || null;
}

/** Build a ResumeDocument: facts from the profile, wording from the (already guarded) draft. */
export function assembleResume(profile: ProfileSnapshot, draft: ResumeDraft, templateId = "classic"): ResumeDocument {
  const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const exps = byId(profile.experiences);
  const edus = byId(profile.education);
  const certs = byId(profile.certifications);
  const projects = byId(profile.projects);

  return {
    templateId,
    header: {
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      headline: draft.headline,
      email: profile.email,
      phone: profile.phone,
      location: cityStateOf(profile),
      links: Object.entries(profile.links)
        .filter(([, url]) => Boolean(url))
        .map(([k, url]) => ({ label: LINK_LABELS[k] ?? k, url: url as string })),
    },
    summary: draft.summary,
    experience: draft.experiences.flatMap(({ experienceId, bullets }) => {
      const e = exps.get(experienceId);
      if (!e) return [];
      const equivalent = draft.titleEquivalents?.[e.id]?.trim();
      return [{ sourceId: e.id, company: e.company, title: equivalent ? `${e.title} (${equivalent})` : e.title, location: e.location, startDate: e.startDate, endDate: e.isCurrent ? null : e.endDate ?? null, bullets }];
    }),
    ...(draft.competencies?.length ? { competencies: draft.competencies } : {}),
    skills: draft.skills,
    education: draft.educationIds.flatMap((id) => {
      const e = edus.get(id);
      return e ? [{ sourceId: e.id, school: e.school, degree: e.degree, field: e.field, endDate: e.endDate }] : [];
    }),
    certifications: draft.certificationIds.flatMap((id) => {
      const c = certs.get(id);
      return c ? [{ sourceId: c.id, name: c.name, issuer: c.issuer, issueDate: c.issueDate }] : [];
    }),
    projects: draft.projects.flatMap(({ projectId, description }) => {
      const p = projects.get(projectId);
      return p ? [{ sourceId: p.id, name: p.name, description }] : [];
    }),
    additional: additionalSections(profile),
  };
}

const EXTRA_HEADINGS = { LANGUAGE: "Languages", AWARD: "Awards", PUBLICATION: "Publications", VOLUNTEER: "Volunteer work" } as const;

function additionalSections(profile: ProfileSnapshot) {
  return (Object.keys(EXTRA_HEADINGS) as Array<keyof typeof EXTRA_HEADINGS>)
    .map((kind) => ({
      heading: EXTRA_HEADINGS[kind],
      items: profile.extras.filter((x) => x.kind === kind).map((x) => (x.detail ? `${x.title} — ${x.detail}` : x.title)),
    }))
    .filter((s) => s.items.length > 0);
}

/** A resume built straight from the profile, no AI — "Version 1 · Original". */
export function resumeFromProfile(profile: ProfileSnapshot): ResumeDocument {
  return assembleResume(profile, {
    headline: profile.headline,
    summary: profile.summary ?? "",
    experiences: profile.experiences.map((e) => ({ experienceId: e.id, bullets: [...e.achievements, ...e.responsibilities].slice(0, 6) })),
    skills: profile.skills.map((s) => s.name),
    educationIds: profile.education.map((e) => e.id),
    certificationIds: profile.certifications.map((c) => c.id),
    projects: profile.projects.map((p) => ({ projectId: p.id, description: [p.description, p.results].filter(Boolean).join(" ") })),
  });
}

/** The skill sections of a resume, in print order, titled the way an ATS expects. */
export function skillSections(doc: Pick<ResumeDocument, "competencies" | "skills">): Array<{ title: string; items: string[] }> {
  const competencies = doc.competencies ?? [];
  return [
    ...(competencies.length ? [{ title: "Core competencies", items: competencies }] : []),
    ...(doc.skills.length ? [{ title: competencies.length ? "Technical skills" : "Skills", items: doc.skills }] : []),
  ];
}

/** Flat text of a resume, for keyword coverage and ATS checks. */
export function resumeText(doc: ResumeDocument): string {
  return [
    doc.header.headline,
    doc.summary,
    ...doc.experience.flatMap((e) => [e.title, e.company, ...e.bullets]),
    (doc.competencies ?? []).join(", "),
    doc.skills.join(", "),
    ...doc.education.map((e) => [e.degree, e.field, e.school].filter(Boolean).join(" ")),
    ...doc.certifications.map((c) => c.name),
    ...doc.projects.map((p) => `${p.name} ${p.description}`),
    ...(doc.additional ?? []).flatMap((a) => a.items),
  ].join("\n");
}
