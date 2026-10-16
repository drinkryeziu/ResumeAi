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
  skills: string[];
  education: Array<{ sourceId: string; school: string; degree?: string | null; field?: string | null; endDate?: string | null }>;
  certifications: Array<{ sourceId: string; name: string; issuer?: string | null; issueDate?: string | null }>;
  projects: Array<{ sourceId: string; name: string; description: string }>;
  /** Languages, awards, publications, volunteer work — copied from the profile as written. */
  additional?: Array<{ heading: string; items: string[] }>;
}

export interface CoverLetterDocument {
  sender: { name: string; email: string; phone?: string | null; location?: string | null };
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
  educationIds: string[];
  certificationIds: string[];
  projects: Array<{ projectId: string; description: string }>;
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
      location: locationOf(profile),
      links: Object.entries(profile.links)
        .filter(([, url]) => Boolean(url))
        .map(([k, url]) => ({ label: LINK_LABELS[k] ?? k, url: url as string })),
    },
    summary: draft.summary,
    experience: draft.experiences.flatMap(({ experienceId, bullets }) => {
      const e = exps.get(experienceId);
      if (!e) return [];
      return [{ sourceId: e.id, company: e.company, title: e.title, location: e.location, startDate: e.startDate, endDate: e.isCurrent ? null : e.endDate ?? null, bullets }];
    }),
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

/** Flat text of a resume, for keyword coverage and ATS checks. */
export function resumeText(doc: ResumeDocument): string {
  return [
    doc.header.headline,
    doc.summary,
    ...doc.experience.flatMap((e) => [e.title, e.company, ...e.bullets]),
    doc.skills.join(", "),
    ...doc.education.map((e) => [e.degree, e.field, e.school].filter(Boolean).join(" ")),
    ...doc.certifications.map((c) => c.name),
    ...doc.projects.map((p) => `${p.name} ${p.description}`),
    ...(doc.additional ?? []).flatMap((a) => a.items),
  ].join("\n");
}
