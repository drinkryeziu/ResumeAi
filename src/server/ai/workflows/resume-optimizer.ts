import { z } from "zod/v4";
import type { ProfileSnapshot } from "@/server/domain/profile";
import type { ResumeDraft } from "@/server/documents/model";
import { buildEvidence, evidenceBlock } from "../evidence";
import { inventedNumbers, unknownEvidence, unknownRows, unsupportedSkills, type CitedText } from "../guard/fabrication-guard";
import { containsTerm, normalize } from "../text";
import { GROUNDING_RULES, wrapJob, type WorkflowDefinition } from "../workflow";
import type { MatchReport } from "./candidate-match";
import type { JobAnalysis } from "./job-analyzer";

export interface OptimizeInput {
  profile: ProfileSnapshot; // includes approved gap answers
  job: { title: string; company: string; description: string };
  analysis: JobAnalysis;
  match: MatchReport;
  /** ATS findings when the user clicks "Improve resume" after a check. */
  improvementNotes?: string[];
}

const Cited = z.object({ text: z.string(), evidenceIds: z.array(z.string()).min(1) });

export const OptimizedResumeSchema = z.object({
  headline: z.string().describe("The candidate's professional title — their profile headline or a title they have actually held"),
  summary: Cited.describe("3–4 sentences, tailored to the job, only from evidence"),
  experiences: z
    .array(
      z.object({
        experienceId: z.string(),
        bullets: z.array(Cited).min(1).max(6).describe("Strongest, most relevant first. Start with a verb."),
      }),
    )
    .describe("Roles to include, most relevant first. Omit only clearly irrelevant, old roles."),
  skills: z.array(z.string()).max(25).describe("Profile skills and tools, most relevant to the job first"),
  educationIds: z.array(z.string()),
  certificationIds: z.array(z.string()),
  projects: z.array(z.object({ projectId: z.string(), description: Cited })).max(4),
  changeNotes: z.array(z.string()).max(8).describe("Plain-language notes on what was changed and why"),
  questions: z.array(z.object({ topic: z.string(), question: z.string() })).max(5).describe("Ask instead of inventing"),
});
export type OptimizedResume = z.infer<typeof OptimizedResumeSchema>;

export const resumeOptimizer: WorkflowDefinition<OptimizeInput, OptimizedResume> = {
  name: "resume_optimizer",
  promptVersion: "resume-optimizer@1",
  actionKey: "OPTIMIZE_RESUME",
  schema: OptimizedResumeSchema,

  prompt: ({ profile, job, analysis, match, improvementNotes }) => ({
    system: `${GROUNDING_RULES}

Task: write a resume tailored to the job below, using only the candidate's evidence.
You MAY: rewrite the summary; reword bullets to be clearer and lead with impact; reorder roles, bullets and skills by relevance; use the job's terminology where the evidence truly supports it; drop irrelevant detail.
You MUST NOT: add employers, titles, schools, certifications, skills, tools, achievements or numbers that are not in the evidence; change dates (you never write dates — the app copies them).
- Each bullet cites the evidence it rephrases. A bullet may only cite evidence from its own role (ids starting with that role's id) or approved answers.
- Numbers (%, $, counts) may only appear if the cited evidence contains that exact number.
- Keep bullets under 30 words. Keep ATS-friendly plain text: no tables, no symbols as bullets, no first person.`,
    user: `${wrapJob(job.title, job.company, job.description)}

<job_priorities>
Most important keywords: ${analysis.keywords.filter((k) => k.importance !== "low").map((k) => k.term).join(", ") || "—"}
Partially shown (state these more clearly if the evidence supports it): ${match.partial.join("; ") || "—"}
Not in evidence (do NOT claim these): ${match.missing.join("; ") || "—"}
${improvementNotes?.length ? `Fix these issues from the last compatibility check:\n- ${improvementNotes.join("\n- ")}` : ""}
</job_priorities>

<profile_rows>
Roles: ${profile.experiences.map((e) => `[${e.id}] ${e.title} at ${e.company}`).join("; ")}
Education: ${profile.education.map((e) => `[${e.id}] ${e.school}`).join("; ") || "—"}
Certifications: ${profile.certifications.map((c) => `[${c.id}] ${c.name}`).join("; ") || "—"}
Projects: ${profile.projects.map((p) => `[${p.id}] ${p.name}`).join("; ") || "—"}
Headline options: ${allowedHeadlines(profile).join(" | ")}
</profile_rows>

${evidenceBlock(buildEvidence(profile))}`,
  }),

  mock: (input) => heuristicOptimize(input),

  check: ({ profile }, out) => checkOptimizedResume(profile, out),
};

export function allowedHeadlines(profile: ProfileSnapshot): string[] {
  return [...new Set([profile.headline, ...profile.experiences.map((e) => e.title)].filter(Boolean))];
}

export function checkOptimizedResume(profile: ProfileSnapshot, out: OptimizedResume): string[] {
  const evidence = buildEvidence(profile);
  const cited: CitedText[] = [
    { ...out.summary, where: "summary" },
    ...out.experiences.flatMap((e) => e.bullets.map((b, i) => ({ ...b, where: `role ${e.experienceId} bullet ${i + 1}` }))),
    ...out.projects.map((p) => ({ ...p.description, where: `project ${p.projectId}` })),
  ];
  const v = [
    ...unknownRows("experiences", out.experiences.map((e) => e.experienceId), profile.experiences),
    ...unknownRows("education", out.educationIds, profile.education),
    ...unknownRows("certifications", out.certificationIds, profile.certifications),
    ...unknownRows("projects", out.projects.map((p) => p.projectId), profile.projects),
    ...unknownEvidence(cited, evidence),
    ...inventedNumbers(cited, evidence),
    ...unsupportedSkills(out.skills, profile),
  ];
  // A bullet may only cite its own role or user-approved answers — no borrowing achievements across jobs.
  const factIds = new Set(profile.approvedFacts.map((f) => f.id));
  for (const e of out.experiences) {
    e.bullets.forEach((b, i) => {
      const foreign = b.evidenceIds.filter((id) => !(id === e.experienceId || id.startsWith(`${e.experienceId}#`) || factIds.has(id)));
      if (foreign.length) v.push(`role ${e.experienceId} bullet ${i + 1}: cites evidence from another role (${foreign.join(", ")}).`);
    });
  }
  if (!allowedHeadlines(profile).some((h) => normalize(h) === normalize(out.headline))) {
    v.push(`headline: "${out.headline}" is not a title from the profile. Use one of: ${allowedHeadlines(profile).join(" | ")}.`);
  }
  return v;
}

export function toResumeDraft(out: OptimizedResume): ResumeDraft {
  return {
    headline: out.headline,
    summary: out.summary.text,
    experiences: out.experiences.map((e) => ({ experienceId: e.experienceId, bullets: e.bullets.map((b) => b.text) })),
    skills: out.skills,
    educationIds: out.educationIds,
    certificationIds: out.certificationIds,
    projects: out.projects.map((p) => ({ projectId: p.projectId, description: p.description.text })),
  };
}

// ───────────── mock: reorder by relevance, never reword (so it is trivially grounded) ─────────────

function heuristicOptimize({ profile, analysis, match }: OptimizeInput): OptimizedResume {
  const terms = analysis.keywords.map((k) => k.term);
  const relevance = (t: string) => terms.filter((k) => containsTerm(t, k)).length;
  const experiences = profile.experiences.map((e) => {
    const bullets = [
      ...e.achievements.map((t, i) => ({ text: t, evidenceIds: [`${e.id}#a${i}`], bonus: 1 })),
      ...e.responsibilities.map((t, i) => ({ text: t, evidenceIds: [`${e.id}#r${i}`], bonus: 0 })),
    ]
      .sort((a, b) => relevance(b.text) + b.bonus - (relevance(a.text) + a.bonus))
      .slice(0, 5)
      .map(({ text, evidenceIds }) => ({ text, evidenceIds }));
    return { experienceId: e.id, bullets: bullets.length ? bullets : [{ text: `${e.title} at ${e.company}.`, evidenceIds: [e.id] }] };
  });
  // Approved gap answers are the user's own words: add them to the most recent role, citing the answer.
  const approved = profile.approvedFacts.filter((f) => f.status === "APPROVED" && f.answer);
  if (approved.length && experiences[0]) {
    experiences[0].bullets = [...approved.map((f) => ({ text: f.answer!.replace(/\.?$/, "."), evidenceIds: [f.id] })), ...experiences[0].bullets].slice(0, 6);
  }
  const allSkills = [...new Set([...profile.skills.map((s) => s.name), ...profile.experiences.flatMap((e) => e.tools)])];
  const skills = allSkills.sort((a, b) => relevance(b) - relevance(a)).slice(0, 20);
  return {
    headline: profile.headline,
    summary: { text: profile.summary ?? `${profile.headline}.`, evidenceIds: profile.summary ? ["summary"] : [profile.experiences[0]?.id ?? "summary"] },
    experiences,
    skills,
    educationIds: profile.education.map((e) => e.id),
    certificationIds: profile.certifications.map((c) => c.id),
    projects: profile.projects.slice(0, 3).map((p) => ({ projectId: p.id, description: { text: [p.description, p.results].filter(Boolean).join(" ") || p.name, evidenceIds: [p.id] } })),
    changeNotes: [
      "Put your most job-relevant achievements first in each role.",
      "Ordered skills so the ones this job asks for come first.",
      ...(approved.length ? [`Added ${approved.length === 1 ? "your answer" : "your answers"} about ${approved.map((f) => f.topic.toLowerCase()).join("; ")}.`] : []),
      ...(match.partial.length ? [`Kept wording close to your profile for: ${match.partial.slice(0, 2).join("; ")}.`] : []),
    ],
    questions: match.questions.slice(0, 3).map((q) => ({ topic: q.topic, question: q.question })),
  };
}

// ───────────── Master Resume: a strong general resume from the profile, no target job ─────────────

export const masterResume: WorkflowDefinition<{ profile: ProfileSnapshot }, OptimizedResume> = {
  name: "master_resume",
  promptVersion: "master-resume@1",
  actionKey: "MASTER_RESUME",
  schema: OptimizedResumeSchema,

  prompt: ({ profile }) => ({
    system: `${GROUNDING_RULES}

Task: write the candidate's Master Resume — a strong, general resume for their professional title (${profile.headline || "their field"}), not targeted at a specific job.
You MAY: write a clear 3–4 sentence summary; reword bullets to be concise and lead with impact; order bullets strongest first; order skills by importance for their title.
You MUST NOT add anything that is not in the evidence, or write dates. Same citation rules: each bullet cites evidence from its own role or approved answers; numbers only if the cited evidence has them.
Include every role, education entry and certification. Leave "questions" empty unless something essential is unclear.`,
    user: `<profile_rows>
Roles: ${profile.experiences.map((e) => `[${e.id}] ${e.title} at ${e.company}`).join("; ")}
Education: ${profile.education.map((e) => `[${e.id}] ${e.school}`).join("; ") || "—"}
Certifications: ${profile.certifications.map((c) => `[${c.id}] ${c.name}`).join("; ") || "—"}
Projects: ${profile.projects.map((p) => `[${p.id}] ${p.name}`).join("; ") || "—"}
Headline options: ${allowedHeadlines(profile).join(" | ")}
</profile_rows>

${evidenceBlock(buildEvidence(profile))}`,
  }),

  mock: ({ profile }) => {
    const out = heuristicOptimize({
      profile,
      job: { title: profile.headline, company: "", description: "" },
      analysis: { title: profile.headline, seniority: "unspecified", minYears: null, summary: "", responsibilities: [], requirements: [], keywords: [] },
      match: { scores: { overall: 0, categories: { skills: null, experience: null, keywords: null, education: null, tools: null, industry: null } }, assessments: [], strong: [], partial: [], missing: [], missingKeywords: [], matchingKeywords: [], questions: [] },
    });
    return { ...out, changeNotes: ["Built from your profile, with your strongest results first in each role."], questions: [] };
  },

  check: ({ profile }, out) => checkOptimizedResume(profile, out),
};
