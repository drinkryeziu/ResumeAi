import { z } from "zod/v4";
import type { ProfileSnapshot } from "@/server/domain/profile";
import type { ResumeDraft } from "@/server/documents/model";
import { experienceYears, yearsMentioned, type CareerModelOutput } from "../experience";
import { buildEvidence, claimableTerms, evidenceBlock } from "../evidence";
import { badInferredSkills, badTitleEquivalents, inventedNumbers, overlongYears, unknownEvidence, unknownRows, unsupportedCompetencies, unsupportedKeywordUse, unsupportedSkills, type CitedText } from "../guard/fabrication-guard";
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

const ids = z.array(z.string()).catch([]);
const Cited = z.object({ text: z.string(), evidenceIds: ids });

// Limits on how many items to write are asked for in the descriptions and enforced by `sanitize`, not by the schema: a model
// that writes seven bullets instead of six should get its seventh trimmed, not have the whole answer thrown away.
export const OptimizedResumeSchema = z.object({
  headline: z.string().describe("The candidate's professional title — their profile headline or a title they have actually held"),
  summary: Cited.describe("3–4 sentences, tailored to the job, only from evidence"),
  experiences: z
    .array(
      z.object({
        experienceId: z.string(),
        bullets: z.array(Cited).describe("1 to 6 bullets, strongest and most relevant first. Start with a verb."),
      }),
    )
    .describe("Roles to include, most relevant first. Omit only clearly irrelevant, old roles."),
  coreCompetencies: z
    .array(z.string())
    .catch([])
    .describe(
      "At most 12. The Core Competencies section, built for this reader (not a copy of the skills list): functional expertise, leadership, collaboration, process and domain strengths. Each must be a skill the candidate listed, or one of your inferredSkills, or a supported term. Most relevant first.",
    ),
  skills: z.array(z.string()).catch([]).describe("At most 25. Technical Skills: only the software, platforms, languages, design tools, frameworks, systems and methods that are in the profile, most relevant first"),
  inferredSkills: z
    .array(z.object({ name: z.string().describe("A short competency name, e.g. 'Cross-functional collaboration'"), evidenceIds: ids, reason: z.string().catch("").describe("One short sentence: what in the evidence shows it") }))
    .catch([])
    .describe("At most 8. Competencies the candidate never listed but their own responsibilities, achievements or projects clearly demonstrate. Never tools, languages, certifications or degrees. Empty when nothing is clearly shown."),
  titleEquivalents: z
    .array(z.object({ experienceId: z.string(), equivalent: z.string().describe("A plain industry-standard functional title, e.g. 'Senior Product/UX Designer'"), evidenceIds: ids }))
    .catch([])
    .describe("At most 6. Only for roles whose official title is vague or company-specific (e.g. 'Experience Designer III'). The official title is always kept; this is added after it. Empty when titles are already clear."),
  educationIds: ids,
  certificationIds: ids,
  projects: z.array(z.object({ projectId: z.string(), description: Cited })).catch([]).describe("At most 4"),
  changeNotes: z.array(z.string()).catch([]).describe("At most 8 plain-language notes on what was changed and why"),
  questions: z.array(z.object({ topic: z.string(), question: z.string() })).catch([]).describe("At most 5. Ask instead of inventing"),
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
          leadership: z.enum(["people", "project", "none"]).catch("none").describe("people = managed, hired or coached people; project = led a team or project without managing people; none"),
        }),
      )
      .describe("One entry for EVERY role"),
    titleGroups: z
      .array(z.object({ name: z.string(), experienceIds: z.array(z.string()), reason: z.string() }))
      .catch([])
      .describe("At most 5 groups of roles with different titles that are the same profession, and why. Only when the work supports it."),
    progression: z.array(z.string()).catch([]).describe("At most 6. How the career developed, one short sentence per step, using only facts in the evidence"),
    strengths: z.array(z.string()).catch([]).describe("At most 6. The candidate's strongest points, from the evidence"),
    differentiators: z.array(z.string()).catch([]).describe("At most 5. What sets this candidate apart, from the evidence"),
    gaps: z.array(z.string()).catch([]).describe("At most 6. Information that would make the resume stronger (for example 'Add a result with a number for your role at X'). Never invent it."),
  }),
});
export type MasterOutput = z.infer<typeof MasterResumeSchema>;

/**
 * Makes an answer that is almost right fully right, without ever adding a fact. Anything that fails its own rule is dropped or
 * replaced by the candidate's own words, and lists are cut to size:
 *  - citations are kept only if they exist (and, for a bullet, belong to its own role or an approved answer);
 *  - a bullet, summary or project that states a number or a span of years its evidence doesn't support is dropped;
 *  - a role left with no bullet gets its own profile lines back, a failed summary becomes the profile's summary;
 *  - an inferred skill without evidence, a technical skill that is not in the profile, a title equivalent that claims too much,
 *    and a headline that is not the candidate's own title are dropped or put right.
 * So an almost-right answer is never refunded and thrown away, and a wrong claim still never reaches a document.
 */
export function sanitizeOptimized<T extends OptimizedResume>(profile: ProfileSnapshot, out: T, supportedTerms: string[] = []): T {
  const evidence = buildEvidence(profile);
  const known = new Set(evidence.map((e) => e.id));
  const factIds = new Set(profile.approvedFacts.map((f) => f.id));
  const roles = new Map(profile.experiences.map((e) => [e.id, e]));
  const pick = (listed: string[], rows: Array<{ id: string }>) => {
    const real = [...new Set(listed.filter((id) => rows.some((r) => r.id === id)))];
    return real.length > 0 ? real : rows.map((r) => r.id);
  };
  const cleanIds = (list: string[]) => [...new Set(list.filter((id) => known.has(id)))];
  const ownIds = (roleId: string, list: string[]) => cleanIds(list).filter((id) => id === roleId || id.startsWith(`${roleId}#`) || factIds.has(id));
  const statesOnlyWhatIsShown = (text: string, evidenceIds: string[]) => {
    const cited = [{ text, evidenceIds, where: "" }];
    return inventedNumbers(cited, evidence).length === 0 && overlongYears(cited, evidence, profile).length === 0;
  };

  // Roles: only real ones, each once, each with at least one supported bullet.
  const seenRoles = new Set<string>();
  const experiences = out.experiences.flatMap((e) => {
    const role = roles.get(e.experienceId);
    if (!role || seenRoles.has(role.id)) return [];
    seenRoles.add(role.id);
    let bullets = e.bullets
      .flatMap((b) => {
        const text = b.text.trim();
        const citedIds = ownIds(role.id, b.evidenceIds);
        return text && citedIds.length > 0 && statesOnlyWhatIsShown(text, citedIds) ? [{ text, evidenceIds: citedIds }] : [];
      })
      .slice(0, 6);
    if (bullets.length === 0) {
      bullets = [
        ...role.achievements.map((t, i) => ({ text: t, evidenceIds: [`${role.id}#a${i}`] })),
        ...role.responsibilities.map((t, i) => ({ text: t, evidenceIds: [`${role.id}#r${i}`] })),
      ].slice(0, 4);
    }
    if (bullets.length === 0) bullets = [{ text: `${role.title} at ${role.company}.`, evidenceIds: [role.id] }];
    return [{ experienceId: role.id, bullets }];
  });

  // A model that returned no usable role at all gets every role back in the candidate's own words.
  if (experiences.length === 0) {
    for (const role of profile.experiences) {
      const lines = [
        ...role.achievements.map((t, i) => ({ text: t, evidenceIds: [`${role.id}#a${i}`] })),
        ...role.responsibilities.map((t, i) => ({ text: t, evidenceIds: [`${role.id}#r${i}`] })),
      ].slice(0, 4);
      experiences.push({ experienceId: role.id, bullets: lines.length ? lines : [{ text: `${role.title} at ${role.company}.`, evidenceIds: [role.id] }] });
    }
  }

  // Summary: the model's own, with the line that adds up the candidate's dates cited when it states their years (never longer than that).
  const total = Math.floor(experienceYears(profile));
  const years = yearsMentioned(out.summary.text);
  let summaryIds = cleanIds(out.summary.evidenceIds);
  if (years.length > 0 && years.every((n) => n <= total) && !summaryIds.includes("experience_total")) summaryIds = [...summaryIds, "experience_total"];
  const summaryText = out.summary.text.trim();
  const summary =
    summaryText && summaryIds.length > 0 && statesOnlyWhatIsShown(summaryText, summaryIds)
      ? { text: summaryText, evidenceIds: summaryIds }
      : profile.summary?.trim()
        ? { text: profile.summary.trim(), evidenceIds: ["summary"] }
        : { text: `${profile.headline || "Professional"}.`, evidenceIds: [profile.experiences[0]?.id ?? "summary"] };

  const projects = out.projects
    .flatMap((p) => {
      const proj = profile.projects.find((x) => x.id === p.projectId);
      const citedIds = cleanIds(p.description.evidenceIds);
      const text = p.description.text.trim();
      return proj && text && citedIds.length > 0 && statesOnlyWhatIsShown(text, citedIds) ? [{ projectId: proj.id, description: { text, evidenceIds: citedIds } }] : [];
    })
    .slice(0, 4);

  const have = new Set(out.skills.map((s) => s.trim().toLowerCase()));
  const inferredSkills = out.inferredSkills.filter((s) => badInferredSkills([s], profile, evidence).length === 0 && !have.has(s.name.trim().toLowerCase())).slice(0, 8);
  // A core competency is either something the candidate listed, a competency their work shows (and cites), or a supported job term.
  const listed = claimableTerms(profile);
  const allowed = new Set([...listed, ...inferredSkills.map((s) => s.name.trim().toLowerCase()), ...supportedTerms.map((t) => t.trim().toLowerCase())]);
  const coreCompetencies = [...new Set(out.coreCompetencies.map((c) => c.trim()).filter((c) => c && allowed.has(c.toLowerCase())))].slice(0, 12);
  // The headline is the candidate's own title; technical skills must be in the profile.
  const headline = allowedHeadlines(profile).some((h) => normalize(h) === normalize(out.headline)) ? out.headline : profile.headline || out.headline;
  const skills = [...new Set(out.skills.map((s) => s.trim()).filter((s) => s && listed.has(s.toLowerCase())))].slice(0, 25);

  return {
    ...out,
    headline,
    summary,
    experiences,
    skills,
    inferredSkills,
    coreCompetencies,
    titleEquivalents: out.titleEquivalents.filter((t) => badTitleEquivalents([t], profile).length === 0).slice(0, 6),
    // Every education entry and certification belongs on the resume; a list the model left out or got wrong is filled in from the profile.
    educationIds: pick(out.educationIds, profile.education),
    certificationIds: pick(out.certificationIds, profile.certifications),
    projects,
    changeNotes: out.changeNotes.slice(0, 8),
    questions: out.questions.slice(0, 5),
  };
}

/** The Master Resume's career reading, with the same tolerance: unknown ids dropped, missing roles filled with a plain default. */
export function sanitizeMaster(profile: ProfileSnapshot, out: MasterOutput): MasterOutput {
  const base = sanitizeOptimized(profile, out);
  const known = new Set(profile.experiences.map((e) => e.id));
  const seen = new Set<string>();
  const roles = out.career.roles.filter((r) => known.has(r.experienceId) && !seen.has(r.experienceId) && seen.add(r.experienceId));
  for (const e of profile.experiences) {
    if (!seen.has(e.id)) roles.push({ experienceId: e.id, profession: e.title, industry: "Unclear", leadership: "none" });
  }
  const c = out.career;
  return {
    ...base,
    career: {
      ...c,
      roles,
      titleGroups: c.titleGroups.filter((g) => g.experienceIds.length >= 2 && g.experienceIds.every((id) => known.has(id))).slice(0, 5),
      progression: c.progression.slice(0, 6),
      strengths: c.strengths.slice(0, 6),
      differentiators: c.differentiators.slice(0, 5),
      gaps: c.gaps.slice(0, 6),
    },
  };
}

export const resumeOptimizer: WorkflowDefinition<OptimizeInput, OptimizedResume> = {
  name: "resume_optimizer",
  promptVersion: "resume-optimizer@3",
  actionKey: "OPTIMIZE_RESUME",
  schema: OptimizedResumeSchema,

  prompt: ({ profile, job, analysis, match, improvementNotes }) => ({
    system: `${GROUNDING_RULES}

Task: read the whole candidate evidence and the whole job description, then write a new, substantially rewritten resume for this one position. Do not merely edit, paraphrase or rearrange: understand what the candidate actually did, what competencies that work demonstrates, and what the employer is looking for, then say it in the strongest accurate professional language.

Rewriting. You may rewrite every bullet from scratch. You do not have to keep the original sentence structure, wording or bullet layout. You may combine related bullets (cite all the evidence they draw on), split a crowded one, replace task wording with stronger professional wording, turn informal wording into industry-standard terms, put achievements before routine duties, lead with what matters most to this job, play down what does not, clarify scope and ownership, and surface the leadership, collaboration, strategy, execution and problem-solving the work shows. The new bullet may look nothing like the original as long as its factual meaning is supported.
Bullets: Action + responsibility or initiative + scope or context + impact, whenever the evidence gives those parts. Never invent an impact; with no result given, strengthen the wording without making one up. Keep every metric exactly as written and never create a percentage, amount, team size or result. Under 30 words each, strongest and most relevant first, no generic filler.

Meaning, not exact words. Do not ask whether a skill appears word for word in the resume; ask whether the candidate's actual work gives reasonable evidence for it. "Worked with developers, marketing and product managers on launches" supports "collaborated cross-functionally with Product, Engineering and Marketing stakeholders". "Redesigned onboarding and cut completion time by 30%" may support customer experience, UX optimization, process improvement, workflow optimization and user-centered design, depending on the surrounding evidence. Use the employer's terms when the underlying meaning is shown. Never keyword-stuff, and never use a job term the evidence does not support.
Strength of evidence: stated outright → use it. Clearly demonstrated by responsibilities or achievements → name and use it. Strongly implied by the whole context → use it only when a careful reader would agree. Weak or only possible → do not state it. Unsupported or unrelated → never add it.

Sections you fill:
- headline: the candidate's own professional title (their headline or a title they actually held).
- summary: not generic. Position them for this role with their relevant years of experience (never more than the "experience_total" line), specialization, relevant industry expertise, leadership level, strongest competencies, most relevant achievement and what sets them apart. Every claim must be defensible from the evidence.
- coreCompetencies: a new section built for this job, not a copy of the skills list. Draw on explicit skills, skills the work demonstrates, competencies behind the achievements, leadership, functional and domain expertise and transferable strengths, plus supported job terms. Each item must be a skill the candidate listed, one of your inferredSkills (each cites the evidence that shows it), or a supported term below.
- skills (Technical Skills): only verifiable software, platforms, languages, design tools, frameworks, systems, technologies and methods that appear in the profile. Never add a tool because the job names it; if the work supports a competency but not a technology, add the competency, not the technology.
- inferredSkills: every competency you name that the candidate never wrote down, each with the evidence ids that show it. Competencies only, never tools, languages, certifications or degrees; no management experience without evidence.
- titleEquivalents: a plain functional equivalent after a vague, company-specific official title. The official title is always kept; never replace a title to match the job.

Facts stay fixed: employers, dates, schools, certifications and real metrics are copied by the app. You never write dates, employers, projects, clients, industries, awards, revenue, budgets, team sizes, percentages or years of experience that the evidence does not give. Create new language, not new history.
Citations: each bullet cites the evidence it draws on, and may only cite evidence from its own role (ids starting with that role's id) or approved answers. Numbers (%, $, counts) appear only if the cited evidence has that exact number.
Length: one page for early-career candidates, one to two pages for most experienced professionals; drop the weakest bullets first. ATS-friendly plain text: no tables, no symbols as bullets, no first person.`,
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

  sanitize: ({ profile, match }, out) => sanitizeOptimized(profile, out, match.keywordStrategy?.supported.map((k) => k.term)),

  check: ({ profile, match }, out) => checkOptimizedResume(profile, out, match),
};

export function allowedHeadlines(profile: ProfileSnapshot): string[] {
  return [...new Set([profile.headline, ...profile.experiences.map((e) => e.title)].filter(Boolean))];
}

export function checkOptimizedResume(profile: ProfileSnapshot, out: OptimizedResume, match?: MatchReport): string[] {
  const supportedTerms = match?.keywordStrategy?.supported.map((k) => k.term) ?? [];
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
    ...unsupportedCompetencies(out.coreCompetencies, out.inferredSkills, profile, supportedTerms),
  ];
  // Job keywords with no evidence behind them never appear, even if an answer elsewhere mentions them.
  const answered = normalize(profile.approvedFacts.filter((f) => f.status === "APPROVED").map((f) => `${f.topic} ${f.answer ?? ""}`).join(" "));
  const avoid = (match?.keywordStrategy?.unsupported ?? []).filter((k) => !answered.includes(normalize(k)));
  if (avoid.length) {
    v.push(
      ...unsupportedKeywordUse(
        // The skill lists only, and not what the writer cites evidence for: prose and inferred skills are held to their citations,
        // so the writer can use the employer's words for what the work shows even where the match step was more cautious.
        [
          ...out.skills.map((s) => ({ text: s, where: "skills" })),
          ...out.coreCompetencies.filter((c) => !out.inferredSkills.some((i) => normalize(i.name) === normalize(c))).map((s) => ({ text: s, where: "core competencies" })),
        ],
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

/** The model's notes, plus a plain line naming every skill the candidate never wrote down, so nothing is added silently. */
export function changeNotesOf(out: OptimizedResume): string[] {
  const named = out.inferredSkills.map((s) => s.name.trim());
  return [...out.changeNotes, ...(named.length ? [`Named skills your work shows: ${named.join(", ")}. Remove any that don't fit when you edit.`] : [])];
}

export function toResumeDraft(out: OptimizedResume): ResumeDraft {
  return {
    headline: out.headline,
    summary: out.summary.text,
    experiences: out.experiences.map((e) => ({ experienceId: e.experienceId, bullets: e.bullets.map((b) => b.text) })),
    // Competencies the work shows are competencies, whether or not the model repeated them in the core list.
    competencies: [...out.coreCompetencies, ...out.inferredSkills.map((s) => s.name.trim()).filter((n) => !out.coreCompetencies.some((x) => x.trim().toLowerCase() === n.toLowerCase()))],
    skills: out.skills,
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
  const isTool = (c: string) => c === "TOOL" || c === "TECHNICAL";
  const competencies = [...new Set(profile.skills.filter((s) => !isTool(s.category)).map((s) => s.name))].sort((a, b) => relevance(b) - relevance(a)).slice(0, 10);
  const allSkills = [...new Set([...profile.skills.filter((s) => isTool(s.category)).map((s) => s.name), ...profile.experiences.flatMap((e) => e.tools)])];
  const skills = allSkills.sort((a, b) => relevance(b) - relevance(a)).slice(0, 20);
  return {
    headline: profile.headline,
    summary: { text: profile.summary ?? `${profile.headline}.`, evidenceIds: profile.summary ? ["summary"] : [profile.experiences[0]?.id ?? "summary"] },
    experiences,
    coreCompetencies: competencies,
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
  promptVersion: "master-resume@3",
  actionKey: "MASTER_RESUME",
  schema: MasterResumeSchema,

  prompt: ({ profile }) => ({
    system: `${GROUNDING_RULES}

Task: write the candidate's Master Resume from scratch: a strong, general resume for their professional title (${profile.headline || "their field"}), not targeted at any employer. There is no job description, so do not imagine one or use keywords from an imaginary employer; use widely recognized terminology for the profession the work shows. Understand what the candidate actually did and what it demonstrates, then say it in the strongest accurate professional language. Do not merely paraphrase or rearrange.
Rewriting: you may rewrite every bullet from scratch, combine related bullets (cite all the evidence they draw on), split crowded ones, replace task wording with professional wording, put achievements before routine duties, and clarify scope and ownership. Bullets: action + responsibility + scope + impact, only where the evidence gives those parts; never invent an impact; keep every metric exactly as written and never create a number. Summary: specific, with their specialization, leadership level, strongest competencies, best achievement and years of experience (never more than the "experience_total" line).
Meaning, not exact words: if the candidate's work clearly demonstrates a competency they never wrote down, you may name and use it (each such skill goes in inferredSkills with the evidence that shows it; competencies only, never tools, languages, certifications, degrees or management experience without evidence). Weak or only possible → do not state it.
coreCompetencies: a section built for this candidate, not a copy of the skills list: functional expertise, leadership, collaboration, process and domain strengths; each a skill they listed or one of your inferredSkills. skills (Technical Skills): only software, platforms, languages, design tools, frameworks, systems and methods in the profile. titleEquivalents: a plain functional equivalent after a vague, company-specific official title; the official title is always kept.
You MUST NOT add anything not in the evidence, or write dates, employers, projects, clients, awards, revenue, budgets, team sizes or percentages the evidence does not give. Each bullet cites evidence from its own role or approved answers; numbers only if the cited evidence has them. Create new language, not new history.
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

  sanitize: ({ profile }, out) => sanitizeMaster(profile, out),

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
