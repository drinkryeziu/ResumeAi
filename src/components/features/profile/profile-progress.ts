import { ProfileInputSchema, type ProfileInput } from "@/server/domain/profile-schema";

/** The editor's sections, in page order. */
export const SECTIONS = [
  ["personal", "Personal information"],
  ["links", "Professional links"],
  ["summary", "Summary"],
  ["experience", "Work experience"],
  ["education", "Education"],
  ["skills", "Skills"],
  ["certifications", "Certifications"],
  ["projects", "Projects"],
  ["additional", "Languages & more"],
  ["application", "Application questions"],
] as const;

export type SectionId = (typeof SECTIONS)[number][0];

/** The first-time setup, in order. Every editor section belongs to exactly one step; "review" has none. */
export const SETUP_STEPS = [
  { key: "details", label: "Your details", sections: ["personal", "links", "summary"] },
  { key: "experience", label: "Experience", sections: ["experience"] },
  { key: "education", label: "Education and skills", sections: ["education", "skills", "certifications", "projects", "additional"] },
  { key: "application", label: "Application questions", sections: ["application"] },
  { key: "review", label: "Review", sections: [] },
] as const satisfies ReadonlyArray<{ key: string; label: string; sections: readonly SectionId[] }>;

/** complete: filled in · attention: a required field is missing or invalid · empty: optional and not added yet. */
export type SectionStatus = "complete" | "attention" | "empty";

export interface ProfileIssue {
  section: SectionId;
  /** Dotted path of the field, e.g. "experiences.0.company". Matches the editor's `data-field` attributes. */
  field: string;
  message: string;
  /** Names the item for a person, e.g. "Project Coordinator — end month". Used in the save bar. */
  label: string;
}

export interface ProfileProgress {
  issues: ProfileIssue[];
  /** First problem message per field, for inline errors. */
  errors: Map<string, string>;
  sections: Record<SectionId, { status: SectionStatus; issues: ProfileIssue[] }>;
  completeCount: number;
}

const PERSONAL = new Set(["firstName", "lastName", "headline", "email", "phone", "city", "state", "country"]);

function sectionOf(first: string): SectionId {
  if (PERSONAL.has(first)) return "personal";
  if (first === "links") return "links";
  if (first === "summary") return "summary";
  if (first === "experiences") return "experience";
  if (first === "education") return "education";
  if (first === "skills") return "skills";
  if (first === "certifications") return "certifications";
  if (first === "projects") return "projects";
  if (first === "application") return "application";
  return "additional";
}

const hasText = (v: unknown) => typeof v === "string" && v.trim().length > 0;

function hasContent(id: SectionId, p: ProfileInput): boolean {
  switch (id) {
    case "personal":
      return true; // required: judged by its issues alone
    case "links":
      return Object.values(p.links).some(hasText);
    case "summary":
      return hasText(p.summary);
    case "experience":
      return p.experiences.length > 0;
    case "education":
      return p.education.length > 0;
    case "skills":
      return Object.values(p.skills).some((a) => a.length > 0);
    case "certifications":
      return p.certifications.length > 0;
    case "projects":
      return p.projects.length > 0;
    case "additional":
      return Object.values(p.extras).some((a) => a.length > 0);
    case "application":
      return Object.values(p.application ?? {}).some(hasText);
  }
}

const WHAT: Record<string, string> = {
  firstName: "first name",
  lastName: "last name",
  headline: "professional title",
  email: "email address",
  phone: "phone number",
  company: "company",
  title: "job title",
  startDate: "start month",
  endDate: "end month (or tick “I currently work here”)",
  school: "school",
  name: "name",
  description: "description",
};
const LINK_NAMES: Record<string, string> = { linkedin: "LinkedIn", portfolio: "Portfolio", github: "GitHub", behance: "Behance", dribbble: "Dribbble", website: "Website" };
const ENTRY: Record<string, string> = { experiences: "Job", education: "Education", certifications: "Certification", projects: "Project" };

/** A person-friendly name for the item a field belongs to: "Project Coordinator — end month", "Education 2 — school", "Email address". */
export function describeField(p: ProfileInput, field: string): string {
  const [top, index, last] = field.split(".");
  const what = WHAT[last ?? top ?? ""] ?? last ?? top ?? "field";
  if (top === "experiences" && index === undefined) return "At least one job";
  if (top && index !== undefined && top in ENTRY) {
    const n = Number(index);
    const entry = (p[top as keyof ProfileInput] as unknown as Array<Record<string, unknown>>)[n];
    const named = [entry?.title, entry?.company, entry?.school, entry?.name].find((v) => typeof v === "string" && v.trim()) as string | undefined;
    return `${named?.trim() || `${ENTRY[top]} ${n + 1}`} — ${what}`;
  }
  if (top === "links") return `${LINK_NAMES[index ?? ""] ?? "Web"} link`;
  return what.charAt(0).toUpperCase() + what.slice(1);
}

/**
 * Has the person already started this entry (a job, school, certification or project)? Then its missing required fields are
 * worth marking right away; for a form that is still completely blank the marks wait until they try to continue.
 */
export function isStartedField(p: ProfileInput, field: string): boolean {
  const [top, index] = field.split(".");
  if (!top || index === undefined || !(top in ENTRY)) return false;
  const entry = (p[top as keyof ProfileInput] as unknown as Array<Record<string, unknown>>)[Number(index)];
  if (!entry) return false;
  return Object.entries(entry).some(([k, v]) => k !== "id" && (typeof v === "string" ? v.trim() !== "" : Array.isArray(v) ? v.length > 0 : v === true));
}

/**
 * What's missing before Save will work. The rules come straight from the server schema, so the
 * editor can never disagree with what the server accepts.
 */
export function profileProgress(p: ProfileInput): ProfileProgress {
  const issues: ProfileIssue[] = [];
  const result = ProfileInputSchema.safeParse(p);
  if (!result.success) {
    for (const i of result.error.issues) {
      const path = i.path.map(String);
      // "Your answers" is not a profile section: its one rule (a Yes needs a sentence) is checked by the editor itself, and nothing
      // in it may hold up Save for the rest of the profile.
      if (path[0] === "answers") continue;
      // The "current job or end month" rule is attached to the whole job; show it on the end-month field.
      const field = path.length === 2 && path[0] === "experiences" ? `${path.join(".")}.endDate` : path.join(".");
      const message = path[0] === "links" ? "Enter a full web address, like https://example.com." : i.message;
      issues.push({ section: sectionOf(path[0] ?? ""), field, message, label: describeField(p, field) });
    }
  }
  if (p.experiences.length === 0) {
    issues.push({
      section: "experience",
      field: "experiences",
      message: "Add at least one job (or internship, volunteer role or project work) so we can build your resume.",
      label: "At least one job",
    });
  }

  const errors = new Map<string, string>();
  for (const i of issues) if (!errors.has(i.field)) errors.set(i.field, i.message);

  const sections = {} as ProfileProgress["sections"];
  let completeCount = 0;
  for (const [id] of SECTIONS) {
    const own = issues.filter((i) => i.section === id);
    const status: SectionStatus = own.length ? "attention" : hasContent(id, p) ? "complete" : "empty";
    if (status === "complete") completeCount++;
    sections[id] = { status, issues: own };
  }
  return { issues, errors, sections, completeCount };
}

/** The required items still missing on one setup step. A step can't be left until this is empty. */
export function issuesForStep(progress: ProfileProgress, step: number): ProfileIssue[] {
  const sections: readonly SectionId[] = SETUP_STEPS[step]?.sections ?? [];
  return progress.issues.filter((i) => sections.includes(i.section));
}
