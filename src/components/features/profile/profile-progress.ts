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
] as const;

export type SectionId = (typeof SECTIONS)[number][0];

/** complete: filled in · attention: a required field is missing or invalid · empty: optional and not added yet. */
export type SectionStatus = "complete" | "attention" | "empty";

export interface ProfileIssue {
  section: SectionId;
  /** Dotted path of the field, e.g. "experiences.0.company". Matches the editor's `data-field` attributes. */
  field: string;
  message: string;
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
  }
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
      // The "current job or end month" rule is attached to the whole job; show it on the end-month field.
      const field = path.length === 2 && path[0] === "experiences" ? `${path.join(".")}.endDate` : path.join(".");
      const message = path[0] === "links" ? "Enter a full web address, like https://example.com." : i.message;
      issues.push({ section: sectionOf(path[0] ?? ""), field, message });
    }
  }
  if (p.experiences.length === 0) {
    issues.push({ section: "experience", field: "experiences", message: "Add at least one job (or internship, volunteer role or project work) so we can build your resume." });
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
