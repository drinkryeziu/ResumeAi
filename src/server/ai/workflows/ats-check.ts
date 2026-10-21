import { z } from "zod/v4";
import { resumeText, type ResumeDocument } from "@/server/documents/model";
import { keywordCoverage } from "../scoring";
import { containsTerm, tokens } from "../text";
import { GROUNDING_RULES, type WorkflowDefinition } from "../workflow";
import type { MatchReport } from "./candidate-match";
import type { JobAnalysis } from "./job-analyzer";

/**
 * "ATS Compatibility Score" — an estimate of how well a resume's structure and wording line up with
 * the job. We never claim to predict an employer's real ATS. All numbers here are computed in code;
 * the model only turns the findings into plain-language suggestions.
 */

export interface StructureFinding {
  id: string;
  ok: boolean;
  label: string;
  fix: string;
}

export function structureChecks(doc: ResumeDocument): StructureFinding[] {
  const words = resumeText(doc).split(/\s+/).filter(Boolean).length;
  const bullets = doc.experience.flatMap((e) => e.bullets);
  return [
    { id: "contact", ok: Boolean(doc.header.email && doc.header.phone), label: "Email and phone number", fix: "Add both an email address and a phone number." },
    { id: "summary", ok: doc.summary.trim().split(/\s+/).length >= 25, label: "Professional summary", fix: "Write a 3–4 sentence summary at the top." },
    { id: "experience", ok: doc.experience.length > 0, label: "Work experience section", fix: "Add at least one role." },
    { id: "dates", ok: doc.experience.every((e) => /^\d{4}-\d{2}$/.test(e.startDate)), label: "Dates on every role", fix: "Give every role a start month and year." },
    { id: "bullets", ok: doc.experience.every((e) => e.bullets.length >= 2), label: "At least 2 bullets per role", fix: "Describe each role with 2–5 bullets." },
    { id: "bullet-length", ok: bullets.every((b) => b.split(/\s+/).length <= 35), label: "Bullets under 35 words", fix: "Split or shorten long bullets." },
    { id: "first-person", ok: !bullets.some((b) => /\b(I|my|me)\b/.test(b)), label: "No first-person pronouns in bullets", fix: 'Start bullets with a verb instead of "I".' },
    { id: "skills", ok: doc.skills.length + (doc.competencies?.length ?? 0) >= 5, label: "Skills section with 5+ items", fix: "List at least five relevant skills." },
    { id: "education", ok: doc.education.length > 0, label: "Education section", fix: "Add your education." },
    { id: "length", ok: words >= 300 && words <= 1100, label: "Length about 1–2 pages", fix: words < 300 ? "Add more detail to your roles." : "Trim older or less relevant detail." },
  ];
}

export const ATS_LABELS = {
  skills: "Skills match",
  keywords: "Keywords",
  experience: "Experience",
  education: "Education",
  structure: "Resume structure",
  alignment: "Job alignment",
} as const;
export type AtsCategory = keyof typeof ATS_LABELS;

export interface AtsScores {
  overall: number;
  categories: Record<AtsCategory, number>;
  missingKeywords: string[];
  findings: StructureFinding[];
}

export function scoreAts(doc: ResumeDocument, analysis: JobAnalysis, match: MatchReport): AtsScores {
  const text = resumeText(doc);
  const findings = structureChecks(doc);
  const kw = keywordCoverage(analysis, text);
  const skillTerms = analysis.requirements.filter((r) => ["skill", "tool", "technical", "soft_skill"].includes(r.category)).flatMap((r) => r.keywords);
  const skillsCovered = skillTerms.filter((t) => containsTerm(text, t)).length;
  const titleTerms = tokens(analysis.title);
  const alignTitle = titleTerms.length ? titleTerms.filter((t) => containsTerm(`${doc.header.headline} ${doc.summary}`, t)).length / titleTerms.length : 1;
  const respTerms = [...new Set(analysis.responsibilities.flatMap(tokens))];
  const alignResp = respTerms.length ? respTerms.filter((t) => containsTerm(text, t)).length / respTerms.length : 1;

  const categories: Record<AtsCategory, number> = {
    skills: skillTerms.length ? Math.round((skillsCovered / skillTerms.length) * 100) : 100,
    keywords: kw.score,
    experience: match.scores.categories.experience ?? 100,
    education: match.scores.categories.education ?? 100,
    structure: Math.round((findings.filter((f) => f.ok).length / findings.length) * 100),
    alignment: Math.round((alignTitle * 0.5 + alignResp * 0.5) * 100),
  };
  const w: Record<AtsCategory, number> = { skills: 0.25, keywords: 0.25, experience: 0.15, education: 0.05, structure: 0.15, alignment: 0.15 };
  const overall = Math.round((Object.keys(w) as AtsCategory[]).reduce((s, k) => s + categories[k] * w[k], 0));
  return { overall, categories, missingKeywords: kw.missing, findings };
}

export interface AtsInput {
  resume: ResumeDocument;
  analysis: JobAnalysis;
  match: MatchReport;
  scores: AtsScores;
}

export const AtsAdviceSchema = z.object({
  weakSections: z.array(z.object({ section: z.string(), reason: z.string() })).describe("At most 5"),
  suggestions: z.array(z.string()).describe("At most 8. Concrete, truthful edits. Never suggest claiming skills the candidate lacks."),
  underrepresented: z.array(z.string()).describe("At most 6 important job requirements the resume does not state clearly"),
});
export type AtsAdvice = z.infer<typeof AtsAdviceSchema>;

export const atsChecker: WorkflowDefinition<AtsInput, AtsAdvice> = {
  name: "ats_check",
  promptVersion: "ats-check@1",
  actionKey: "ATS_CHECK",
  schema: AtsAdviceSchema,
  sanitize: (_input, out) => ({ weakSections: out.weakSections.slice(0, 5), suggestions: out.suggestions.slice(0, 8), underrepresented: out.underrepresented.slice(0, 6) }),
  prompt: ({ resume, analysis, match, scores }) => ({
    system: `${GROUNDING_RULES}

Task: review a resume against a job and give short, practical advice. Scores are already computed; do not output numbers.
Only suggest changes the candidate can make truthfully: rewording, reordering, stating existing experience more clearly.
For requirements the candidate lacks, suggest they add it only "if you have this experience".`,
    user: `<resume>\n${resumeText(resume)}\n</resume>
<findings>
Failed structure checks: ${scores.findings.filter((f) => !f.ok).map((f) => f.label).join("; ") || "none"}
Missing keywords: ${scores.missingKeywords.join(", ") || "none"}
Partially supported requirements: ${match.partial.join("; ") || "none"}
Job title: ${analysis.title}
</findings>`,
  }),
  mock: ({ scores, match }) => ({
    weakSections: scores.findings.filter((f) => !f.ok).slice(0, 4).map((f) => ({ section: f.label, reason: f.fix })),
    suggestions: [
      ...scores.findings.filter((f) => !f.ok).map((f) => f.fix),
      ...scores.missingKeywords.slice(0, 3).map((k) => `If you have experience with ${k}, add it to your profile so it can appear in your resume.`),
    ].slice(0, 8),
    underrepresented: match.partial.slice(0, 6),
  }),
};
