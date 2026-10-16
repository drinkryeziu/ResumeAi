/**
 * Default price list and plans. These are SEED values only: at runtime prices are read from the
 * CreditAction / Plan / CreditPack tables, so they can change without a deploy.
 * Business logic must never import these constants directly — use the pricing repository.
 */

export const CREDIT_ACTION_KEYS = [
  "ANALYZE_JOB",
  "JOB_MATCH",
  "OPTIMIZE_RESUME",
  "GENERATE_COVER_LETTER",
  "EDIT_COVER_LETTER",
  "ATS_CHECK",
  "PARSE_RESUME",
  "MASTER_RESUME",
  "MASTER_COVER_LETTER",
] as const;
export type CreditActionKey = (typeof CREDIT_ACTION_KEYS)[number];

export const DEFAULT_CREDIT_ACTIONS: Array<{ key: CreditActionKey; label: string; credits: number; description: string }> = [
  { key: "ANALYZE_JOB", label: "Analyze job", credits: 5, description: "Pull out requirements, skills and keywords from a job description." },
  { key: "JOB_MATCH", label: "Check job match", credits: 5, description: "Compare your profile with the job and find gaps." },
  { key: "OPTIMIZE_RESUME", label: "Optimize resume", credits: 15, description: "Create a resume tailored to this job." },
  { key: "GENERATE_COVER_LETTER", label: "Write cover letter", credits: 10, description: "Write a cover letter for this job." },
  { key: "EDIT_COVER_LETTER", label: "Rewrite cover letter", credits: 3, description: "Shorten, expand or change the tone." },
  { key: "ATS_CHECK", label: "ATS compatibility check", credits: 3, description: "Check structure and keyword coverage." },
  { key: "PARSE_RESUME", label: "Import resume", credits: 0, description: "Read an uploaded resume into your profile." },
  { key: "MASTER_RESUME", label: "Create Master Resume", credits: 0, description: "Build your Master Resume from your profile." },
  { key: "MASTER_COVER_LETTER", label: "Create Master Cover Letter", credits: 0, description: "Write a general cover letter from your profile." },
];

export const DEFAULT_PLANS = [
  { key: "FREE", name: "Free", priceCents: 0, interval: "NONE", monthlyCredits: 0, signupCredits: 60, sortOrder: 0 },
  { key: "STARTER", name: "Starter", priceCents: 999, interval: "MONTH", monthlyCredits: 300, signupCredits: 0, sortOrder: 1 },
  { key: "PRO", name: "Pro", priceCents: 1999, interval: "MONTH", monthlyCredits: 800, signupCredits: 0, sortOrder: 2 },
  { key: "PREMIUM", name: "Premium", priceCents: 2999, interval: "MONTH", monthlyCredits: 1500, signupCredits: 0, sortOrder: 3 },
] as const;

export const DEFAULT_CREDIT_PACKS = [
  { name: "100 credits", credits: 100, priceCents: 499 },
  { name: "500 credits", credits: 500, priceCents: 1999 },
] as const;
