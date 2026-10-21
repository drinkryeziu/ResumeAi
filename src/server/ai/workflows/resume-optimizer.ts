import { z } from "zod/v4";
import type { ProfileSnapshot } from "@/server/domain/profile";
import type { ResumeDraft } from "@/server/documents/model";
import type { CareerModelOutput } from "../experience";
import { buildEvidence, evidenceBlock } from "../evidence";
import { badInferredSkills, badTitleEquivalents, inventedNumbers, overlongYears, unknownEvidence, unknownRows, unsupportedKeywordUse, unsupportedSkills, type CitedText } from "../guard/fabrication-guard";
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
  skills: z.array(z.string()).max(25).describe("Skills and tools that are in the profile: competencies first, then tools and technologies, most relevant first"),
  inferredSkills: z
    .array(z.object({ name: z.string().describe("A short competency name, e.g. 'Cross-functional collaboration'"), evidenceIds: z.array(z.string()).min(1), reason: z.string().describe("One short sentence: what in the evidence shows it") }))
    .max(8)
    .describe("Competencies the candidate never listed but their own responsibilities, achievements or projects clearly demonstrate. Never tools, languages, certifications or degrees. Empty when nothing is clearly shown."),
  titleEquivalents: z
    .array(z.object({ experienceId: z.string(), equivalent: z.string().describe("A plain industry-standard functional title, e.g. 'Senior Product/UX Designer'"), evidenceIds: z.array(z.string()).min(1) }))
    .max(6)
    .describe("Only for roles whose official title is vague or company-specific (e.g. 'Experience Designer III'). The official title is always kept; this is added after it. Empty when titles are already clear."),
  educationIds: z.array(z.string()),
  certificationIds: z.array(z.string()),
  projects: z.array(z.object({ projectId: z.string(), description: Cited })).max(4),
  changeNotes: z.array(z.string()).max(8).describe("Plain-language notes on what was changed and why"),
  questions: z.array(z.object({ topic: z.string(), question: z.string() })).max(5).describe("Ask instead of inventing"),
});
export type OptimizedResume = z.infer<typeof OptimizedResumeSchema>;

/** The Master Resume also reads the career as a whole (no job): professions, industries, progression, strengths and gaps. */
export const MasterResumeSchema = OptimizedResumeSchema.extend({
  career: z.object({
    primaryProfession: z.string().describe("The candidate's main profession in plain words, judged from the work done"),
    seniority: z.string().describe("e.g. 'Early career', 'Mid-level individual contributor', 'Senior', 'Team lead', 'Executive'"),
    roles: z
      .array(
        z.object({
          experienceId: z.string(),
          profession: z.string().describe("The profession this role actually was, judged from the work and not the title's wording"),
          industry: z.string().describe("The industry the employer works in"),
          leadership: z.enum(["people", "project", "none"]).describe("people = managed, hired or coached people; project = led a team or project without managing people; none"),
        }),
      )
      .describe("One entry for EVERY role"),
    titleGroups: z
      .array(z.object({ name: z.string(), experienceIds: z.array(z.string()).min(2), reason: z.string() }))
      .max(5)
      .describe("Roles with different titles that are the same profession, and why. Only when the work supports it."),
    progression: z.array(z.string()).max(6).describe("How the career developed, one short sentence per step, using only facts in the evidence"),
    strengths: z.array(z.string()).max(6).describe("The candidate's strongest points, from the evidence"),
    differentiators: z.array(z.string()).max(5).describe("What sets this candidate apart, from the evidence"),
    gaps: z.array(z.string()).max(6).describe("Information that would make the resume stronger (for example 'Add a result with a number for your role at X'). Never invent it."),
  }),
});
export type MasterOutput = z.infer<typeof MasterResumeSchema>;

/**
 * Optional extras that fail their own rules are dropped, not repaired and not allowed to fail the whole run:
 * an inferred skill without evidence, or a title equivalent that claims too much.
 */
export function sanitizeOptimized<T extends OptimizedResume>(profile: ProfileSnapshot, out: T): T {
  const evidence = buildEvidence(profile);
  const have = new Set(out.skills.map((s) => s.trim().toLowerCase()));
  return {
    ...out,
    inferredSkills: out.inferredSkills.filter((s) => badInferredSkills([s], profile, evidence).length === 0 && !have.has(s.name.trim().toLowerCase())),
    titleEquivalents: out.titleEquivalents.filter((t) => badTitleEquivalents([t], profile).length === 0),
  };
}

export const resumeOptimizer: WorkflowDefinition<OptimizeInput, OptimizedResume> = {
  name: "resume_optimizer",
  promptVersion: "resume-optimizer@2",
  actionKey: "OPTIMIZE_RESUME",
  schema: OptimizedResumeSchema,

  prompt: ({ profile, job, analysis, match, improvementNotes }) => ({
    system: `${GROUNDING_RULES}

Task: write a resume tailored to the job below, using only the candidate's evidence. Strengthen, clarify and professionally present real experience; never invent any.
You MAY: rewrite the summary; reword bullets to be clearer and lead with impact; reorder roles, bullets and skills so the strongest relevant evidence comes first and irrelevant detail is played down (career continuity stays); translate existing experience into the employer's terminology where it keeps the same meaning (e.g. "worked with developers, marketing and product" → "collaborated cross-functionally with Product, Engineering and Marketing").
You MUST NOT: add employers, titles, schools, certifications, tools, languages, achievements or numbers that are not in the evidence; change dates (you never write dates — the app copies them); keyword-stuff; use a job keyword the candidate has no evidence for.
- Skills. Every skill the candidate listed is allowed. A skill they did not list may be added in inferredSkills ONLY when their own responsibilities, achievements or projects clearly demonstrate it (managed designers and worked with Product and Engineering → team leadership, cross-functional collaboration, stakeholder management; reduced processing time by 30% → process improvement; ran interviews and usability sessions → user research, usability testing). Each must cite that evidence. Strongly demonstrated: use it. Weakly supported: leave it out. Never infer tools, languages, certifications or degrees.
- Bullets. Where the evidence supports it, write Action + what was done + scope or context + result. If no result is given, strengthen the wording without making one up. Keep every metric exactly as written.
- Job terminology. Use the "supported terms" below freely in wording. Never use the "do not use" terms.
- Titles. Keep official titles. If a title is vague or company-specific, you may add a plain functional equivalent in titleEquivalents (shown after the official title). Never replace a title to match the job.
- Each bullet cites the evidence it rephrases. A bullet may only cite evidence from its own role (ids starting with that role's id) or approved answers.
- Numbers (%, $, counts) may only appear if the cited evidence contains that exact number. Years of experience may not exceed the "experience_total" evidence line.
- Length. One page for early-career candidates, one to two pages for most experienced professionals; keep bullets under 30 words and drop the weakest first. ATS-friendly plain text: no tables, no symbols as bullets, no first person.`,
    user: `${wrapJob(job.title, job.company, job.description)}

<job_priorities>
Most important keywords: ${analysis.keywords.filter((k) => k.importance !== "low").map((k) => k.term).join(", ") || "—"}
Partially shown (state these more clearly if the evidence supports it): ${match.partial.join("; ") || "—"}
Not in evidence (do NOT claim these): ${match.missing.join("; ") || "—"}
Supported terms (the evidence shows these; use the employer's wording): ${match.keywordStrategy?.supported.map((k) => `${k.term} (${k.reason})`).join("; ") || "—"}
Do not use these terms (no evidence): ${match.keywordStrategy?.unsupported.join(", ") || "—"}
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

  sanitize: ({ profile }, out) => sanitizeOptimized(profile, out),

  check: ({ profile, match }, out) => checkOptimizedResume(profile, out, match),
};

export function allowedHeadlines(profile: ProfileSnapshot): string[] {
  return [...new Set([profile.headline, ...profile.experiences.map((e) => e.title)].filter(Boolean))];
}

export function checkOptimizedResume(profile: ProfileSnapshot, out: OptimizedResume, match?: MatchReport): string[] {
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
    ...overlongYears(cited, evidence, profile),
    ...unsupportedSkills(out.skills, profile),
    ...badInferredSkills(out.inferredSkills, profile, evidence),
    ...badTitleEquivalents(out.titleEquivalents, profile),
  ];
  // Job keywords with no evidence behind them never appear, even if an answer elsewhere mentions them.
  const answered = normalize(profile.approvedFacts.filter((f) => f.status === "APPROVED").map((f) => `${f.topic} ${f.answer ?? ""}`).join(" "));
  const avoid = (match?.keywordStrategy?.unsupported ?? []).filter((k) => !answered.includes(normalize(k)));
  if (avoid.length) {
    v.push(
      ...unsupportedKeywordUse(
        [...cited.map((c) => ({ text: c.text, where: c.where })), ...out.skills.map((s) => ({ text: s, where: "skills" })), ...out.inferredSkills.map((s) => ({ text: s.name, where: "inferred skills" }))],
        avoid,
      ),
    );
  }
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
    skills: [...out.skills, ...out.inferredSkills.map((s) => s.name.trim()).filter((n) => !out.skills.some((x) => x.trim().toLowerCase() === n.toLowerCase()))],
    titleEquivalents: Object.fromEntries(out.titleEquivalents.map((t) => [t.experienceId, t.equivalent.trim()])),
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
    inferredSkills: [],
    titleEquivalents: [],
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

export const masterResume: WorkflowDefinition<{ profile: ProfileSnapshot }, MasterOutput> = {
  name: "master_resume",
  promptVersion: "master-resume@2",
  actionKey: "MASTER_RESUME",
  schema: MasterResumeSchema,

  prompt: ({ profile }) => ({
    system: `${GROUNDING_RULES}

Task: write the candidate's Master Resume — a strong, general resume for their professional title (${profile.headline || "their field"}), not targeted at any employer. There is no job description: do not imagine one or use keywords from an imaginary employer; use widely recognized terminology for the profession the work shows.
You MAY: write a clear 3–4 sentence summary; reword bullets to be concise and lead with impact (action + what was done + scope + result, only where the evidence gives it); order bullets strongest first; order skills by importance for their title; add competencies the candidate's own responsibilities and achievements clearly demonstrate in inferredSkills (each cites that evidence; never tools, languages, certifications or degrees); add a plain functional equivalent after a vague, company-specific official title in titleEquivalents (the official title is always kept).
You MUST NOT add anything that is not in the evidence, or write dates. Same citation rules: each bullet cites evidence from its own role or approved answers; numbers only if the cited evidence has them; keep every metric exactly as written; years of experience may not exceed the "experience_total" evidence line.
Include every role, education entry and certification. Leave "questions" empty unless something essential is unclear.

Also read the career as a whole into "career". Profession and industry are separate: a designer in banking and one in healthcare are the same profession in two industries. Judge each role by the work done, not the title's wording; group different titles only when responsibilities, tools and scope show the same profession, and say why. Do not add up years: the app does that from the dates. Strengths, differentiators and progression use only facts in the evidence; "gaps" lists what the candidate could add to be stronger and never states it as fact.`,
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
      analysis: { title: profile.headline, seniority: "unspecified", minYears: null, profession: null, industry: null, relatedIndustries: [], outcomes: [], summary: "", responsibilities: [], requirements: [], keywords: [] },
      match: { scores: { overall: 0, categories: { skills: null, experience: null, keywords: null, education: null, tools: null, industry: null } }, assessments: [], strong: [], partial: [], missing: [], missingKeywords: [], matchingKeywords: [], questions: [] },
    });
    return { ...out, changeNotes: ["Built from your profile, with your strongest results first in each role."], questions: [], career: heuristicCareer(profile) };
  },

  sanitize: ({ profile }, out) => sanitizeOptimized(profile, out),

  check: ({ profile }, out) => {
    const roleIds = new Set(profile.experiences.map((e) => e.id));
    const v = checkOptimizedResume(profile, out);
    const tagged = new Set(out.career.roles.map((r) => r.experienceId));
    for (const id of tagged) if (!roleIds.has(id)) v.push(`career: "${id}" is not a role in the profile.`);
    const missing = [...roleIds].filter((id) => !tagged.has(id));
    if (missing.length) v.push(`career: missing an entry for role ${missing.join(", ")}.`);
    return v;
  },
};

const SENIORITY_WORDS = /\b(senior|sr\.?|junior|jr\.?|lead|principal|staff|head of|chief|associate|intern|ii|iii|iv)\b/gi;

/** Mock career reading: profession from the title without its level, one industry, leadership from the wording. */
function heuristicCareer(profile: ProfileSnapshot): CareerModelOutput {
  const text = (id: string) => normalize([...profile.experiences.filter((e) => e.id === id).flatMap((e) => [...e.responsibilities, ...e.achievements])].join(" "));
  const professionOf = (title: string) => title.replace(SENIORITY_WORDS, " ").replace(/\s+/g, " ").trim() || title;
  const sorted = [...profile.experiences].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return {
    primaryProfession: professionOf(profile.headline || profile.experiences[0]?.title || ""),
    seniority: /senior|lead|principal|head/i.test(profile.headline) ? "Senior" : "Experienced professional",
    roles: profile.experiences.map((e) => ({
      experienceId: e.id,
      profession: professionOf(e.title),
      industry: "General",
      leadership: /manag|mentor|hire|hiring|coach/.test(text(e.id)) ? ("people" as const) : /\bled\b|\blead/.test(text(e.id)) ? ("project" as const) : ("none" as const),
    })),
    titleGroups: [],
    progression: sorted.map((e) => `${e.title} at ${e.company}.`),
    strengths: profile.skills.slice(0, 4).map((s) => s.name),
    differentiators: [],
    gaps: profile.experiences.filter((e) => e.achievements.length === 0).map((e) => `Add a result with a number for your role at ${e.company}, if you have one.`),
  };
}
