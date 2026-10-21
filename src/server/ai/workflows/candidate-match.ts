import { z } from "zod/v4";
import type { ProfileSnapshot } from "@/server/domain/profile";
import { buildEvidence, evidenceBlock, type EvidenceItem } from "../evidence";
import {
  groundAssessments,
  summarizeExperience,
  withoutYearsQuestions,
  type ExperienceSummary,
  type ModelAssessment,
  type RoleTag,
  type TitleGroup,
} from "../experience";
import { computeFit, type FitReport } from "../fit";
import { unknownEvidence } from "../guard/fabrication-guard";
import { keywordCoverage, MATCH_LABELS, scoreMatch, type MatchScores, type RequirementAssessment } from "../scoring";
import { containsTerm, normalize } from "../text";
import { GROUNDING_RULES, type WorkflowDefinition } from "../workflow";
import type { JobAnalysis } from "./job-analyzer";

export interface MatchInput {
  profile: ProfileSnapshot;
  analysis: JobAnalysis;
}

const RoleTagSchema = z.object({
  experienceId: z.string(),
  profession: z.string().describe("The profession or function this role actually was, in plain words (e.g. 'Product and UX design'), judged from the work done and not from the title's wording"),
  industry: z.string().describe("The industry the employer works in (e.g. 'Banking')"),
  professionFit: z.enum(["same", "related", "different"]).describe("Compared with the JOB's profession: the same profession, a closely related one, or a different one"),
  industryFit: z.enum(["direct", "related", "transferable", "unrelated"]).describe("Compared with the JOB's industry: same industry, closely related industry, a different industry, or unrelated. Never call a related industry 'direct'."),
  leadership: z.enum(["people", "project", "none"]).describe("people = managed, hired or coached people; project = led a team, project or program without managing people; none"),
});

/** What the model returns: judgments about roles and requirements. Years and scores are computed afterwards in code. */
export const MatchModelSchema = z.object({
  roles: z.array(RoleTagSchema).describe("One entry for EVERY role in the profile"),
  titleGroups: z
    .array(z.object({ name: z.string().describe("The profession the grouped titles share"), experienceIds: z.array(z.string()).min(2), reason: z.string().describe("One short sentence on why the work is the same") }))
    .max(5)
    .describe("Roles with different titles that are really the same profession, with the reason. Only when the work supports it."),
  assessments: z.array(
    z.object({
      requirementId: z.string(),
      label: z.enum(MATCH_LABELS),
      evidenceIds: z.array(z.string()),
      explanation: z.string().describe("One short sentence a candidate would understand"),
      qualifyingRoleIds: z.array(z.string()).describe("Roles whose work fully satisfies this requirement. For skill and leadership requirements, the roles that show it. Empty when none."),
      relatedRoleIds: z.array(z.string()).describe("Roles that only partly or indirectly satisfy it. Empty when none."),
      yearsDeterminable: z.boolean().describe("For skill or leadership requirements: false when the resume shows the skill was used but not for how long"),
    }),
  ),
  questions: z
    .array(z.object({ requirementId: z.string(), question: z.string().describe("A yes/no question to the candidate, in second person") }))
    .max(8)
    .describe("Ask about important missing or partial requirements instead of assuming. Never ask about years or dates."),
  supportedKeywords: z
    .array(z.object({ term: z.string().describe("A job keyword exactly as in the job's keyword list"), evidenceIds: z.array(z.string()).min(1), reason: z.string() }))
    .max(15)
    .describe("Job keywords the profile does not literally contain but the evidence clearly supports (the same experience in the employer's words)"),
});
export type MatchModelOutput = z.infer<typeof MatchModelSchema>;

/** What the app stores in MatchReport.result. Fields marked "newer" are absent on matches saved before they existed. */
export interface MatchReport {
  scores: MatchScores;
  assessments: RequirementAssessment[];
  strong: string[];
  partial: string[];
  missing: string[];
  missingKeywords: string[];
  /** Job keywords that already appear in the profile ("matching skills"). */
  matchingKeywords: string[];
  questions: Array<{ requirementId: string; topic: string; question: string }>;
  /** Newer: the overall conclusion in words, and how strong each area is. */
  fit?: FitReport;
  /** Newer: experience by profession, industry and both, computed from the dates. */
  experience?: ExperienceSummary;
  /** Newer: which job keywords are present, supported by evidence but unused, or unsupported (and so never added). */
  keywordStrategy?: KeywordStrategy;
}

export interface KeywordStrategy {
  present: string[];
  /** Not worded this way in the profile, but the evidence supports them: the tailored resume uses them. */
  supported: Array<{ term: string; reason: string }>;
  /** No evidence: never added to a resume. */
  unsupported: string[];
}

export const candidateMatch: WorkflowDefinition<MatchInput, MatchModelOutput> = {
  name: "candidate_match",
  promptVersion: "candidate-match@2",
  actionKey: "JOB_MATCH",
  schema: MatchModelSchema,

  prompt: ({ profile, analysis }) => ({
    system: `${GROUNDING_RULES}

Task: judge how well the candidate's evidence supports the job, requirement by requirement. Work from what each role really involved, not from job titles alone.

1. Roles. Tag EVERY role in the profile. Profession and industry are two separate things: a graphic designer in banking and one in healthcare are the same profession in different industries. Different titles can be the same profession when the responsibilities, tools and scope show it (UX Designer, Product Designer and Senior Product Designer can all be product/UX design). Never group titles by wording alone, and say why in titleGroups. Judge each role's profession against the JOB's profession (same / related / different) and its industry against the JOB's industry (direct / related / transferable / unrelated). A closely related industry (FinTech for a banking job) is "related", never "direct", unless the posting itself says related industries count and lists it.
2. Requirements. For each requirement choose a label:
   - strong: clearly meets or exceeds it, with direct, well supported evidence. match: meets it with adequate direct evidence.
   - partial: related or transferable experience that does not fully meet it. weak: some evidence, but well below or outside what is asked.
   - none: no reasonable evidence. unknown: not enough information to judge reliably.
   Be strict: a related tool is "partial", not "strong". Cite evidence ids for every label except none and unknown.
3. Experience requirements. Say which roles qualify (qualifyingRoleIds) and which only partly qualify (relatedRoleIds). Do NOT add up years: the app does that from the dates, counting overlapping jobs once. For a skill ("5+ years of UX research"), list only the roles whose evidence shows the skill was really used; do not assume a skill mentioned once was used throughout the career, and set yearsDeterminable to false when the resume shows the skill was used but not for how long. For leadership, tell people management apart from project or team leadership.
4. Mandatory and preferred requirements are judged the same way; do not let many preferred matches excuse a mandatory gap.
5. Keywords. In supportedKeywords list job keywords the profile does not contain word for word but whose meaning the evidence clearly shows (for example "worked with developers and marketing" supports "cross-functional collaboration"). Never list a keyword just because the job wants it.
6. Questions. For important requirements that are missing or partial, write a short yes/no question (for example "Have you run accessibility testing on a product?"). NEVER ask about years of experience, durations or dates: the dates in the profile answer those.`,
    user: `${evidenceBlock(buildEvidence(profile))}

<job_profile>
Profession: ${analysis.profession ?? "not stated"}
Industry: ${analysis.industry ?? "not stated"}${analysis.relatedIndustries?.length ? `\nIndustries the posting also accepts: ${analysis.relatedIndustries.join(", ")}` : ""}
Roles in the profile: ${profile.experiences.map((e) => `[${e.id}] ${e.title} at ${e.company}`).join("; ")}
Job keywords: ${analysis.keywords.map((k) => k.term).join(", ") || "—"}
</job_profile>

<job_requirements>
${analysis.requirements
  .map((r) => `[${r.id}] (${r.importance}, ${r.category}${r.measures && r.measures !== "none" ? `, measures ${r.measures}` : ""}${r.years ? `, ${r.years} years${r.subject ? ` of ${r.subject}` : ""}` : ""}) ${r.text}`)
  .join("\n")}
</job_requirements>`,
  }),

  mock: ({ profile, analysis }) => heuristicMatch(profile, analysis),

  check: ({ profile, analysis }, out) => {
    const evidence = buildEvidence(profile);
    const reqIds = new Set(analysis.requirements.map((r) => r.id));
    const roleIds = new Set(profile.experiences.map((e) => e.id));
    const keywords = new Set(analysis.keywords.map((k) => normalize(k.term)));
    const v: string[] = [];
    for (const a of out.assessments) {
      if (!reqIds.has(a.requirementId)) v.push(`assessments: unknown requirement "${a.requirementId}".`);
      if (a.label !== "none" && a.label !== "unknown") v.push(...unknownEvidence([{ text: a.explanation, evidenceIds: a.evidenceIds, where: `requirement ${a.requirementId}` }], evidence));
      for (const id of [...a.qualifyingRoleIds, ...a.relatedRoleIds]) if (!roleIds.has(id)) v.push(`requirement ${a.requirementId}: "${id}" is not a role in the profile.`);
    }
    const covered = new Set(out.assessments.map((a) => a.requirementId));
    const notCovered = [...reqIds].filter((id) => !covered.has(id));
    if (notCovered.length) v.push(`assessments: missing an assessment for ${notCovered.join(", ")}.`);
    const tagged = new Set(out.roles.map((r) => r.experienceId));
    for (const id of tagged) if (!roleIds.has(id)) v.push(`roles: "${id}" is not a role in the profile.`);
    const untagged = [...roleIds].filter((id) => !tagged.has(id));
    if (untagged.length) v.push(`roles: missing a tag for ${untagged.join(", ")}.`);
    for (const g of out.titleGroups) for (const id of g.experienceIds) if (!roleIds.has(id)) v.push(`titleGroups: "${id}" is not a role in the profile.`);
    for (const k of out.supportedKeywords) {
      if (!keywords.has(normalize(k.term))) v.push(`supportedKeywords: "${k.term}" is not one of the job's keywords.`);
      v.push(...unknownEvidence([{ text: k.term, evidenceIds: k.evidenceIds, where: `keyword "${k.term}"` }], evidence));
    }
    return v;
  },
};

/** Turn the model's judgments into the stored report: years from the dates, labels, scores, lists, fit and keywords. */
export function buildMatchReport(input: MatchInput, out: MatchModelOutput): MatchReport {
  const { profile, analysis } = input;
  const tags: RoleTag[] = out.roles;
  const groups: TitleGroup[] = out.titleGroups;
  const assessments = groundAssessments(profile, analysis, out.assessments as ModelAssessment[], tags);

  const evidence = buildEvidence(profile).filter((e) => e.kind !== "experience_total");
  const profileText = evidence.map((e) => e.text).join("\n");
  const scores = scoreMatch(analysis, assessments, profileText);
  const coverage = keywordCoverage(analysis, profileText);
  const reqText = new Map(analysis.requirements.map((r) => [r.id, r.text]));
  const pick = (s: RequirementAssessment["status"]) => assessments.filter((a) => a.status === s).map((a) => reqText.get(a.requirementId) ?? a.requirementId);
  const declinedTopics = new Set(profile.approvedFacts.map((f) => f.topic.toLowerCase()));

  // A job keyword is "supported" only when the model cites evidence for it AND the job really lists it.
  const supported = out.supportedKeywords.filter((k) => coverage.missing.some((m) => normalize(m) === normalize(k.term)));
  const supportedTerms = new Set(supported.map((k) => normalize(k.term)));

  return {
    scores,
    assessments,
    strong: pick("strong"),
    partial: pick("partial"),
    missing: pick("missing"),
    missingKeywords: coverage.missing,
    matchingKeywords: coverage.covered,
    // Never re-ask something the user already answered, and never ask about years.
    questions: withoutYearsQuestions(analysis, out.questions)
      .map((q) => ({ ...q, topic: reqText.get(q.requirementId) ?? q.requirementId }))
      .filter((q) => !declinedTopics.has(q.topic.toLowerCase())),
    fit: computeFit(analysis, assessments),
    experience: summarizeExperience(profile, tags, groups),
    keywordStrategy: {
      present: coverage.covered,
      supported: supported.map((k) => ({ term: k.term, reason: k.reason })),
      unsupported: coverage.missing.filter((m) => !supportedTerms.has(normalize(m))),
    },
  };
}

// ───────────── mock: term overlap, so local runs give believable results ─────────────

const SENIORITY = /\b(senior|sr\.?|junior|jr\.?|lead|principal|staff|head of|chief|associate|intern|ii|iii|iv)\b/gi;
const wordsOf = (s: string) => normalize(s.replace(SENIORITY, " ")).split(" ").filter((w) => w.length > 3);

function heuristicMatch(profile: ProfileSnapshot, analysis: JobAnalysis): MatchModelOutput {
  const evidence = buildEvidence(profile).filter((e) => e.kind !== "experience_total");
  const find = (term: string): EvidenceItem[] => evidence.filter((e) => containsTerm(e.text, term));
  const professionWords = wordsOf(analysis.profession ?? analysis.title);
  const industries = [analysis.industry, ...(analysis.relatedIndustries ?? [])].filter(Boolean) as string[];
  const roleText = (id: string) => normalize(evidence.filter((e) => e.id === id || e.parentId === id).map((e) => e.text).join(" "));

  const roles = profile.experiences.map((e): MatchModelOutput["roles"][number] => {
    const text = roleText(e.id);
    const titleHit = wordsOf(e.title).some((w) => professionWords.includes(w));
    const bodyHits = professionWords.filter((w) => text.includes(w)).length;
    const keywordHits = analysis.keywords.filter((k) => containsTerm(text, k.term)).length;
    const professionFit = titleHit ? "same" : bodyHits >= 2 || keywordHits >= 2 ? "related" : "different";
    const direct = analysis.industry ? containsTerm(`${text} ${normalize(e.company)}`, analysis.industry) : false;
    const related = !direct && industries.slice(1).some((i) => containsTerm(`${text} ${normalize(e.company)}`, i));
    const industryFit = direct ? "direct" : related ? "related" : "transferable";
    const leadership = /manag|mentor|hir(e|ing)|coach|direct report/.test(text) ? "people" : /\bled\b|\blead\b|\blead\w*/.test(text) ? "project" : "none";
    return { experienceId: e.id, profession: e.title.replace(SENIORITY, " ").replace(/\s+/g, " ").trim() || e.title, industry: direct ? (analysis.industry ?? "Other") : "Other", professionFit, industryFit, leadership };
  });

  const assessments = analysis.requirements.map((r): MatchModelOutput["assessments"][number] => {
    const base = { requirementId: r.id, qualifyingRoleIds: [] as string[], relatedRoleIds: [] as string[], yearsDeterminable: true };
    if (r.category === "education") {
      const ed = profile.education[0];
      return ed
        ? { ...base, label: "strong", evidenceIds: [ed.id], explanation: "Your education covers this." }
        : { ...base, label: "none", evidenceIds: [], explanation: "No education listed in your profile." };
    }
    const terms = r.keywords.length ? r.keywords : r.text.split(/\s+/).filter((w) => w.length > 6).slice(0, 3);
    const hits = terms.map((t) => find(t)).filter((h) => h.length > 0);
    const ids = [...new Set(hits.flat().map((e) => e.id))].slice(0, 4);
    const parents = [...new Set(hits.flat().map((e) => e.parentId ?? e.id))].filter((id) => profile.experiences.some((e) => e.id === id));
    const all = terms.length && hits.length === terms.length;
    const label = all ? "strong" : hits.length ? "partial" : "none";
    const explanation = label === "strong" ? "Clearly shown in your experience." : label === "partial" ? "Related experience found; it could be stated more directly." : "Not found in your profile.";
    return { ...base, label, evidenceIds: label === "none" ? [] : ids.length ? ids : profile.experiences.slice(0, 1).map((e) => e.id), explanation, qualifyingRoleIds: parents };
  });

  const questions = analysis.requirements
    .filter((r) => r.importance === "required" && assessments.find((a) => a.requirementId === r.id)?.label === "none" && r.category !== "experience" && !(r.measures && r.measures !== "none" && r.years))
    .slice(0, 5)
    .map((r) => ({ requirementId: r.id, question: `This job asks for: "${r.text}". Do you have this experience?` }));

  // Keywords the profile only implies through related wording (mock: a keyword that shares a word with a profile term).
  const profileText = evidence.map((e) => e.text).join(" ");
  const supportedKeywords = analysis.keywords
    .filter((k) => !containsTerm(profileText, k.term))
    .flatMap((k) => {
      const w = wordsOf(k.term).find((x) => x.length > 5 && normalize(profileText).includes(x));
      const hit = w ? evidence.find((e) => normalize(e.text).includes(w)) : undefined;
      return hit ? [{ term: k.term, evidenceIds: [hit.id], reason: `Your profile mentions "${w}".` }] : [];
    })
    .slice(0, 5);

  return { roles, titleGroups: [], assessments, questions, supportedKeywords };
}
