import { z } from "zod/v4";
import type { ProfileSnapshot } from "@/server/domain/profile";
import { buildEvidence, evidenceBlock, type EvidenceItem } from "../evidence";
import { groundYearsRequirements } from "../experience";
import { unknownEvidence } from "../guard/fabrication-guard";
import { keywordCoverage, scoreMatch, totalYears, type MatchScores, type RequirementAssessment } from "../scoring";
import { containsTerm } from "../text";
import { GROUNDING_RULES, type WorkflowDefinition } from "../workflow";
import type { JobAnalysis } from "./job-analyzer";

export interface MatchInput {
  profile: ProfileSnapshot;
  analysis: JobAnalysis;
}

/** What the model returns: classifications + questions. Scores are computed afterwards in code. */
export const MatchModelSchema = z.object({
  assessments: z.array(
    z.object({
      requirementId: z.string(),
      status: z.enum(["strong", "partial", "missing"]),
      evidenceIds: z.array(z.string()),
      explanation: z.string().describe("One short sentence a candidate would understand"),
    }),
  ),
  questions: z
    .array(z.object({ requirementId: z.string(), question: z.string().describe("A yes/no question to the candidate, in second person") }))
    .max(8)
    .describe("Ask about important missing or partial requirements instead of assuming"),
});
export type MatchModelOutput = z.infer<typeof MatchModelSchema>;

/** What the app stores in MatchReport.result. */
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
}

export const candidateMatch: WorkflowDefinition<MatchInput, MatchModelOutput> = {
  name: "candidate_match",
  promptVersion: "candidate-match@1",
  actionKey: "JOB_MATCH",
  schema: MatchModelSchema,

  prompt: ({ profile, analysis }) => ({
    system: `${GROUNDING_RULES}

Task: decide, for EACH job requirement, how well the candidate's evidence supports it.
- strong: evidence clearly shows it. partial: related evidence exists but is indirect or weaker. missing: no evidence.
- strong and partial MUST cite evidence ids. missing cites none.
- Be strict: a related tool is "partial", not "strong". Do not give credit for things the evidence doesn't say.
- For important missing or partial requirements, write a short yes/no question (e.g. "Have you run accessibility testing on a product?").
- Years of experience: the evidence line "experience_total" is the candidate's whole work history added up from the dates. Judge every "N years" requirement against it (a role's own dates show how long they did something). NEVER ask the candidate a question about how many years they have.`,
    user: `${evidenceBlock(buildEvidence(profile))}

<job_requirements>
${analysis.requirements.map((r) => `[${r.id}] (${r.importance}, ${r.category}) ${r.text}`).join("\n")}
</job_requirements>`,
  }),

  mock: ({ profile, analysis }) => heuristicMatch(profile, analysis),

  check: ({ profile, analysis }, out) => {
    const evidence = buildEvidence(profile);
    const reqIds = new Set(analysis.requirements.map((r) => r.id));
    const v: string[] = [];
    for (const a of out.assessments) {
      if (!reqIds.has(a.requirementId)) v.push(`assessments: unknown requirement "${a.requirementId}".`);
      if (a.status !== "missing") v.push(...unknownEvidence([{ text: a.explanation, evidenceIds: a.evidenceIds, where: `requirement ${a.requirementId}` }], evidence));
    }
    const covered = new Set(out.assessments.map((a) => a.requirementId));
    const notCovered = [...reqIds].filter((id) => !covered.has(id));
    if (notCovered.length) v.push(`assessments: missing an assessment for ${notCovered.join(", ")}.`);
    return v;
  },
};

/** Turn the model's classifications into the stored report (scores, lists, keywords). */
export function buildMatchReport(input: MatchInput, modelOut: MatchModelOutput): MatchReport {
  const out = groundYearsRequirements(input.profile, input.analysis, modelOut);
  const profileText = buildEvidence(input.profile).filter((e) => e.kind !== "experience_total").map((e) => e.text).join("\n");
  const scores = scoreMatch(input.analysis, out.assessments, profileText);
  const coverage = keywordCoverage(input.analysis, profileText);
  const reqText = new Map(input.analysis.requirements.map((r) => [r.id, r.text]));
  const pick = (s: string) => out.assessments.filter((a) => a.status === s).map((a) => reqText.get(a.requirementId) ?? a.requirementId);
  const declinedTopics = new Set(input.profile.approvedFacts.map((f) => f.topic.toLowerCase()));
  return {
    scores,
    assessments: out.assessments,
    strong: pick("strong"),
    partial: pick("partial"),
    missing: pick("missing"),
    missingKeywords: coverage.missing,
    matchingKeywords: coverage.covered,
    // Never re-ask something the user already answered.
    questions: out.questions
      .map((q) => ({ ...q, topic: reqText.get(q.requirementId) ?? q.requirementId }))
      .filter((q) => !declinedTopics.has(q.topic.toLowerCase())),
  };
}

// ───────────── mock: term overlap, so local runs give believable results ─────────────

function heuristicMatch(profile: ProfileSnapshot, analysis: JobAnalysis): MatchModelOutput {
  const evidence = buildEvidence(profile).filter((e) => e.kind !== "experience_total");
  const years = totalYears(profile.experiences);
  const find = (term: string): EvidenceItem[] => evidence.filter((e) => containsTerm(e.text, term));

  const assessments = analysis.requirements.map((r): RequirementAssessment => {
    if (r.category === "experience" && analysis.minYears) {
      const ratio = years / analysis.minYears;
      const status = ratio >= 1 ? "strong" : ratio >= 0.7 ? "partial" : "missing";
      return { requirementId: r.id, status, evidenceIds: status === "missing" ? [] : profile.experiences.map((e) => e.id).slice(0, 3), explanation: `About ${years} years of experience in your profile.` };
    }
    if (r.category === "education") {
      const ed = profile.education[0];
      return ed
        ? { requirementId: r.id, status: "strong", evidenceIds: [ed.id], explanation: "Your education covers this." }
        : { requirementId: r.id, status: "missing", evidenceIds: [], explanation: "No education listed in your profile." };
    }
    const terms = r.keywords.length ? r.keywords : r.text.split(/\s+/).filter((w) => w.length > 6).slice(0, 3);
    const hits = terms.map((t) => find(t)).filter((h) => h.length > 0);
    const ids = [...new Set(hits.flat().map((e) => e.id))].slice(0, 4);
    const status = terms.length && hits.length === terms.length ? "strong" : hits.length ? "partial" : "missing";
    const explanation =
      status === "strong" ? "Clearly shown in your experience." : status === "partial" ? "Related experience found; it could be stated more directly." : "Not found in your profile.";
    return { requirementId: r.id, status, evidenceIds: status === "missing" ? [] : ids, explanation };
  });

  const questions = analysis.requirements
    .filter((r) => r.importance === "required" && assessments.find((a) => a.requirementId === r.id)?.status === "missing" && r.category !== "experience")
    .slice(0, 5)
    .map((r) => ({ requirementId: r.id, question: `This job asks for: "${r.text}". Do you have this experience?` }));

  return { assessments, questions };
}
