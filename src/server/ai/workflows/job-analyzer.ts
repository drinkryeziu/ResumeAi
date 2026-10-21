import { z } from "zod/v4";
import type { JobInput } from "@/server/domain/profile";
import { countTerm, normalize } from "../text";
import { GROUNDING_RULES, wrapJob, type WorkflowDefinition } from "../workflow";
import { INDUSTRIES, LEXICON } from "./lexicon";

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

/** What a requirement is measuring decides how experience is counted for it. */
export const REQUIREMENT_MEASURES = ["profession", "industry", "profession_industry", "skill", "leadership", "none"] as const;
export type RequirementMeasure = (typeof REQUIREMENT_MEASURES)[number];

export const RequirementSchema = z.object({
  id: z.string().describe("r1, r2, … in order of appearance"),
  text: z.string().describe("The requirement in a short plain sentence"),
  category: z.enum(REQUIREMENT_CATEGORIES),
  importance: z.enum(["required", "preferred"]),
  keywords: z.array(z.string()).describe("1–4 terms a resume would contain if this requirement is met"),
  measures: z
    .enum(REQUIREMENT_MEASURES)
    .describe(
      "What the employer is measuring. industry: years in an industry ('10+ years in banking'). profession: years in a profession/function ('5+ years in graphic design'), whatever the industry. profession_industry: both together ('5+ years of graphic design in banking'). skill: years of one skill ('5+ years of UX research'). leadership: managing or leading people/projects. none: no experience duration or type is measured (a tool, a degree, a trait).",
    ),
  years: z.number().nullable().describe("The number of years this requirement asks for, or null"),
  subject: z.string().nullable().describe("What the years are of, e.g. 'graphic design', 'banking', 'UX research', or null"),
});

export const JobAnalysisSchema = z.object({
  title: z.string(),
  seniority: z.enum(SENIORITY),
  minYears: z.number().nullable().describe("Minimum years of experience stated, or null"),
  profession: z.string().nullable().describe("The profession or function the job belongs to, in plain words (e.g. 'Product and UX design'), or null"),
  industry: z.string().nullable().describe("The industry the employer works in or asks for (e.g. 'Banking'), or null"),
  relatedIndustries: z.array(z.string()).max(8).describe("Industries the posting says also count (e.g. 'Banking, FinTech or related' → ['FinTech']); empty when it names none"),
  outcomes: z.array(z.string()).max(8).describe("Results the employer expects from this hire, in short plain sentences; empty when none are stated"),
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
  promptVersion: "job-analyzer@2",
  actionKey: "ANALYZE_JOB",
  schema: JobAnalysisSchema,

  prompt: (job) => ({
    system: `${GROUNDING_RULES}

Task: analyze a job description for a candidate who wants to tailor their resume.
- Split requirements into atomic items (one skill or expectation each). Mark "preferred" only when the posting says preferred, nice to have, bonus or plus.
- Categories: skill, soft_skill, technical, tool, experience (years or type of work), leadership, collaboration, education, certification, domain (industry).
- For every requirement decide what it measures (measures, years, subject). Work out what the employer actually asks for: "10+ years in Banking" measures industry; "5+ years in Graphic Design" measures profession; "5+ years of Graphic Design in Banking" measures both together; "5+ years of UX Research" measures one skill.
- Also read the job's profession, its industry and any related industries the posting accepts, and the results the employer expects.
- Separate mandatory ("required") from preferred / nice-to-have requirements. Do not let a long preferred list hide a mandatory one.
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

  const profession = professionOf(job.title);
  const industries = INDUSTRIES.filter((i) => countTerm(lower, i) > 0);
  const professionWords = tokensOf(profession);

  const requirements: Requirement[] = reqLines.slice(0, 20).map((r, i) => {
    const kw = Object.keys(LEXICON).filter((term) => normalize(r.text).includes(term)).slice(0, 4);
    const category = categorize(r.text);
    const reqYears = r.text.match(/(\d+)\+?\s*(?:years|yrs)/i);
    const industry = INDUSTRIES.find((x) => countTerm(normalize(r.text), x) > 0) ?? null;
    const mentionsProfession = professionWords.some((w) => normalize(r.text).includes(w));
    const measures: Requirement["measures"] =
      category === "leadership"
        ? "leadership"
        : reqYears && industry && mentionsProfession
          ? "profession_industry"
          : reqYears && industry
            ? "industry"
            : reqYears && kw.length
              ? "skill"
              : reqYears
                ? "profession"
                : "none";
    const subject = measures === "industry" ? industry : measures === "skill" ? kw[0] ?? null : measures === "none" ? null : profession;
    return { id: `r${i + 1}`, text: r.text, category, importance: r.preferred ? "preferred" : "required", keywords: kw, measures, years: reqYears ? Number(reqYears[1]) : null, subject };
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
    profession,
    industry: industries[0] ?? null,
    relatedIndustries: industries.slice(1, 4),
    outcomes: [],
    summary: `${job.title} at ${job.company}.`,
    responsibilities: responsibilities.slice(0, 12),
    requirements,
    keywords,
  };
}

const SENIORITY_WORDS = /\b(senior|sr\.?|junior|jr\.?|lead|principal|staff|head of|chief|associate|intern|ii|iii|iv)\b/gi;

/** "Senior Product Designer" → "Product Designer": the profession without the level. */
function professionOf(title: string): string {
  return title.replace(SENIORITY_WORDS, " ").replace(/\s+/g, " ").trim() || title;
}

const tokensOf = (s: string) => normalize(s).split(" ").filter((w) => w.length > 3);
