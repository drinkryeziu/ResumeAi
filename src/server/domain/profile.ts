/**
 * Plain domain types for the Master Profile. Mirrors the Prisma models but has no DB dependency,
 * so AI workflows, scoring and document rendering can be tested without a database.
 */

export type SkillCategory = "PROFESSIONAL" | "TECHNICAL" | "TOOL" | "DOMAIN" | "SOFT";

export interface Experience {
  id: string;
  company: string;
  title: string;
  location?: string | null;
  startDate: string; // YYYY-MM
  endDate?: string | null;
  isCurrent: boolean;
  responsibilities: string[];
  achievements: string[];
  tools: string[];
}

export interface EducationItem {
  id: string;
  school: string;
  degree?: string | null;
  field?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
}

export interface SkillItem {
  id: string;
  name: string;
  category: SkillCategory;
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  credentialId?: string | null;
  url?: string | null;
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string | null;
  role?: string | null;
  tools: string[];
  results?: string | null;
}

export interface ExtraItem {
  id: string;
  kind: "LANGUAGE" | "AWARD" | "PUBLICATION" | "VOLUNTEER";
  title: string;
  detail?: string | null;
}

export interface ApprovedFactItem {
  id: string;
  topic: string;
  question: string;
  answer: string | null;
  status: "APPROVED" | "DECLINED";
}

import type { ApplicationAnswers } from "./application-answers";

export interface ProfileSnapshot {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  summary?: string | null;
  links: Partial<Record<"linkedin" | "portfolio" | "github" | "behance" | "dribbble" | "website", string>>;
  experiences: Experience[];
  education: EducationItem[];
  skills: SkillItem[];
  certifications: CertificationItem[];
  projects: ProjectItem[];
  extras: ExtraItem[];
  approvedFacts: ApprovedFactItem[];
  /** Answers to the usual application-form questions. Private: never used in a document and never sent to the AI. Absent on older profiles. */
  application?: ApplicationAnswers;
}

export interface JobInput {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  url?: string | null;
  description: string;
}
