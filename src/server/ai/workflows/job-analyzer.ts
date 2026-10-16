import { z } from "zod/v4";
import type { JobInput } from "@/server/domain/profile";
import { countTerm, normalize } from "../text";
import { GROUNDING_RULES, wrapJob, type WorkflowDefinition } from "../workflow";
import { LEXICON } from "./lexicon";

export const REQUIREMENT_CATEGORIES = [
  "skill",
  "soft_skill",
  "technical",
  "tool",
  "experience",
  "leadership",
  "collaboration",
  "education",
  "certification",
  "domain",
] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export const SENIORITY = ["intern", "entry", "mid", "senior", "lead", "principal", "manager", "director", "executive", "unspecified"] as const;

export const RequirementSchema = z.object({
  id: z.string().describe("r1, r2, … in order of appearance"),
  text: z.string().describe("The requirement in a short plain sentence"),
  category: z.enum(REQUIREMENT_CATEGORIES),
  importance: z.enum(["required", "preferred"]),
  keywords: z.array(z.string()).describe("1–4 terms a resume would contain if this requirement is met"),
});

export const JobAnalysisSchema = z.object({
  title: z.string(),
  seniority: z.enum(SENIORITY),
  minYears: z.number().nullable().describe("Minimum years of experience stated, or null"),
  summary: z.string().describe("One sentence: what this role is for"),
  responsibilities: z.array(z.string()).max(12),
  requirements: z.array(RequirementSchema).max(30),
  keywords: z
    .array(z.object({ term: z.string(), count: z.number().int().min(1), importance: z.enum(["high", "medium", "low"]) }))
    .max(30)
    .describe("Important terms as written in the posting, with how often each appears"),
});

export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;

export const jobAnalyzer: WorkflowDefinition<JobInput, JobAnalysis> = {
  name: "job_analyzer",
  promptVersion: "job-analyzer@1",
  actionKey: "ANALYZE_JOB",
  schema: JobAnalysisSchema,

  prompt: (job) => ({
    system: `${GROUNDING_RULES}

Task: analyze a job description for a candidate who wants to tailor their resume.
- Split requirements into atomic items (one skill or expectation each). Mark "preferred" only when the posting says preferred, nice to have, bonus or plus.
- Categories: skill, soft_skill, technical, tool, experience (years or type of work), leadership, collaboration, education, certification, domain (industry).
- Keywords: terms an applicant-tracking system would look for, written exactly as in the posting; count occurrences; "high" for terms in the title or repeated, "low" for one-off mentions.`,
    user: wrapJob(job.title, job.company, job.description),
  }),

  mock: (job) => heuristicAnalysis(job),

  check: (_job, out) => {
    const ids = out.requirements.map((r) => r.id);
    return ids.length === new Set(ids).size ? [] : ["requirements: ids must be unique."];
  },
};

// ───────────── mock: a rule-based analysis so the flow works without an API key ─────────────

function heuristicAnalysis(job: JobInput): JobAnalysis {
  const text = job.description;
  const lower = normalize(`${job.title}\n${text}`);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let section: "resp" | "req" | "pref" | "other" = "other";
  const responsibilities: string[] = [];
  const reqLines: Array<{ text: string; preferred: boolean }> = [];
  for (const raw of lines) {
    const l = raw.toLowerCase();
    const isHeading = raw.length < 60 && !/^[-•*]/.test(raw) && /:$|^[A-Z][^.]*$/.test(raw);
    if (isHeading) {
      if (/responsib|what you.?ll do|the role|you will/.test(l)) section = "resp";
      else if (/nice to have|preferred|bonus|plus/.test(l)) section = "pref";
      else if (/requirement|qualification|what you.?ll bring|about you|must have|skills/.test(l)) section = "req";
      else section = "other";
      continue;
    }
    const item = raw.replace(/^[-•*]\s*/, "");
    if (section === "resp") responsibilities.push(item);
    else if (section === "req" || section === "pref") reqLines.push({ text: item, preferred: section === "pref" || /preferred|nice to have|a plus|bonus/.test(l) });
  }

  const categorize = (t: string): RequirementCategory => {
    const l = t.toLowerCase();
    if (/\d+\+?\s*(years|yrs)/.test(l)) return "experience";
    if (/degree|bachelor|master|phd|diploma/.test(l)) return "education";
    if (/certif/.test(l)) return "certification";
    if (/lead|mentor|manage|coach/.test(l)) return "leadership";
    if (/collaborat|cross-functional|stakeholder|partner with/.test(l)) return "collaboration";
    const hit = Object.entries(LEXICON).find(([term]) => normalize(l).includes(term));
    return hit ? hit[1] : "skill";
  };

  const requirements: Requirement[] = reqLines.slice(0, 20).map((r, i) => {
    const kw = Object.keys(LEXICON).filter((term) => normalize(r.text).includes(term)).slice(0, 4);
    return { id: `r${i + 1}`, text: r.text, category: categorize(r.text), importance: r.preferred ? "preferred" : "required", keywords: kw };
  });

  const keywords = Object.keys(LEXICON)
    .map((term) => ({ term, count: countTerm(lower, term) }))
    .filter((k) => k.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map((k) => ({
      ...k,
      importance: (normalize(job.title).includes(k.term) || k.count >= 3 ? "high" : k.count === 2 ? "medium" : "low") as "high" | "medium" | "low",
    }));

  const years = lower.match(/(\d+)\+?\s*(?:years|yrs)/);
  const seniority = /principal/.test(lower)
    ? "principal"
    : /\blead\b/.test(normalize(job.title))
      ? "lead"
      : /senior|sr\./.test(lower)
        ? "senior"
        : /junior|entry/.test(lower)
          ? "entry"
          : "mid";

  return {
    title: job.title,
    seniority,
    minYears: years ? Number(years[1]) : null,
    summary: `${job.title} at ${job.company}.`,
    responsibilities: responsibilities.slice(0, 12),
    requirements,
    keywords,
  };
}
