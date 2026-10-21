import { z } from "zod/v4";
import type { ProfileSnapshot } from "@/server/domain/profile";
import type { CoverLetterDocument, ResumeDocument } from "@/server/documents/model";
import { locationOf } from "@/server/documents/model";
import { buildEvidence, evidenceBlock } from "../evidence";
import { inventedNumbers, overlongYears, unknownEvidence, unknownOrganizations } from "../guard/fabrication-guard";
import { normalize } from "../text";
import { GROUNDING_RULES, wrapJob, type WorkflowDefinition } from "../workflow";
import type { JobAnalysis } from "./job-analyzer";

export const TONES = ["PROFESSIONAL", "CONVERSATIONAL", "EXECUTIVE", "CONCISE", "ENTHUSIASTIC"] as const;
export type Tone = (typeof TONES)[number];

const TONE_GUIDE: Record<Tone, string> = {
  PROFESSIONAL: "Clear, confident and polite. 3–4 paragraphs, about 250–320 words.",
  CONVERSATIONAL: "Warm and natural, like a thoughtful email. Contractions are fine. About 250 words.",
  EXECUTIVE: "Strategic and outcome-focused; emphasize leadership and business impact the evidence shows. About 280 words.",
  CONCISE: "Three short paragraphs, under 170 words.",
  ENTHUSIASTIC: "Energetic and positive without exclamation-mark overload. About 250 words.",
};

export type CoverLetterMode = "generate" | "shorten" | "expand" | "retone";

export interface CoverLetterInput {
  profile: ProfileSnapshot;
  resume: ResumeDocument;
  /** null = the Master Cover Letter: a general letter the user adapts, not aimed at one job. */
  job: { title: string; company: string; description: string } | null;
  analysis: JobAnalysis | null;
  tone: Tone;
  mode: CoverLetterMode;
  previous?: string[]; // paragraphs, for shorten/expand/retone
}

export const CoverLetterSchema = z.object({
  paragraphs: z.array(z.object({ text: z.string(), evidenceIds: z.array(z.string()) })).min(2).max(6),
  organizationsMentioned: z.array(z.string()).describe("Every company, school or organization name you mentioned, other than the hiring company"),
});
export type CoverLetterOutput = z.infer<typeof CoverLetterSchema>;

function build(actionKey: "GENERATE_COVER_LETTER" | "EDIT_COVER_LETTER" | "MASTER_COVER_LETTER"): WorkflowDefinition<CoverLetterInput, CoverLetterOutput> {
  return {
    name: "cover_letter",
    promptVersion: "cover-letter@3",
    actionKey,
    schema: CoverLetterSchema,

    prompt: ({ profile, job, analysis, tone, mode, previous }) =>
      !job
        ? {
            system: `${GROUNDING_RULES}

Task: write the candidate's Master Cover Letter — a general letter for roles matching their title (${profile.headline || "their field"}) that they will adapt per job.
Tone: ${TONE_GUIDE[tone]}
- Do not name a company or a specific job. Refer to "your team" and "this role".
- Paragraph 1: who the candidate is and what they do best. Paragraphs 2–3: two or three strongest results from the evidence. Last: a short close.
- Do not write the greeting, sign-off or the candidate's name — the app adds them. Each paragraph cites evidence ids.`,
            user: `${previous?.length ? `<current_letter>\n${previous.join("\n\n")}\n</current_letter>\n\n` : ""}${evidenceBlock(buildEvidence(profile))}`,
          }
        : {
      system: `${GROUNDING_RULES}

Task: ${mode === "generate" ? "write a cover letter" : mode === "shorten" ? "shorten this cover letter by about a third" : mode === "expand" ? "expand this cover letter with more relevant evidence" : `rewrite this cover letter in a ${tone.toLowerCase()} tone`} for the job below.
Tone: ${TONE_GUIDE[tone]}
- Do not repeat the resume. Connect the employer's most important needs with two to four of the candidate's strongest pieces of evidence: relevant experience, industry exposure, achievements, leadership, technical or functional expertise.
- Paragraph 1: the role and a specific, evidence-based reason the candidate fits. Paragraphs 2–3: the strongest matching experiences. Last: a short close.
- If the candidate lacks direct experience but has strong transferable experience, say so positively and truthfully; never pretend it is a direct match. Never claim an industry, tool or requirement the evidence does not show.
- Specific, confident, concise and natural. No clichés or generic filler ("I am writing to express my interest", "passionate team player").
- Years of experience may not exceed the "experience_total" evidence line.
- Do not write the greeting, sign-off or the candidate's name — the app adds them.
- Each paragraph cites evidence ids. The opening and closing paragraphs may cite "summary" or a role id.
- You may mention the hiring company (${job.company}). Do not claim knowledge about the company beyond the job description.`,
      user: `${wrapJob(job.title, job.company, job.description)}

Top job priorities: ${analysis?.keywords.slice(0, 10).map((k) => k.term).join(", ") ?? "—"}
${previous?.length ? `<current_letter>\n${previous.join("\n\n")}\n</current_letter>` : ""}

${evidenceBlock(buildEvidence(profile))}`,
          },

    mock: (input) => templateLetter(input),

    check: ({ profile, job }, out) => {
      const evidence = buildEvidence(profile);
      const cited = out.paragraphs.map((p, i) => ({ ...p, where: `paragraph ${i + 1}` }));
      return [
        ...unknownEvidence(cited, evidence),
        ...inventedNumbers(cited, evidence),
        ...overlongYears(cited, evidence, profile),
        ...unknownOrganizations(out.organizationsMentioned, profile, job ? [job.company] : []),
      ];
    },
  };
}

export const coverLetterGenerator = build("GENERATE_COVER_LETTER");
export const coverLetterEditor = build("EDIT_COVER_LETTER"); // shorten / expand / retone — mode comes from input
export const masterCoverLetter = build("MASTER_COVER_LETTER");

export function toCoverLetterDocument(input: CoverLetterInput, out: CoverLetterOutput, today = new Date()): CoverLetterDocument {
  const name = `${input.profile.firstName} ${input.profile.lastName}`.trim();
  return {
    sender: { name, email: input.profile.email, phone: input.profile.phone, location: locationOf(input.profile) },
    recipient: { company: input.job?.company ?? "", jobTitle: input.job?.title ?? "" },
    date: today.toISOString().slice(0, 10),
    greeting: input.job?.company ? `Dear ${input.job.company} hiring team,` : "Dear Hiring Manager,",
    paragraphs: out.paragraphs.map((p) => p.text),
    closing: input.tone === "CONVERSATIONAL" || input.tone === "ENTHUSIASTIC" ? "Thanks so much," : "Sincerely,",
    signature: name,
  };
}

// ───────────── mock: a template that only restates profile facts ─────────────

function templateLetter({ profile, job, resume, tone, mode }: CoverLetterInput): CoverLetterOutput {
  const evidence = buildEvidence(profile);
  // Resume bullets are profile lines or approved answers (stored as "topic: answer"), possibly with a period added.
  const bare = (s: string) => normalize(s).replace(/\.$/, "");
  const idOf = (text: string) => evidence.find((e) => bare(e.text) === bare(text) || (e.kind === "approved_fact" && bare(e.text).endsWith(bare(text))))?.id;
  const role = profile.experiences.find((e) => e.id === resume.experience[0]?.sourceId) ?? profile.experiences[0];
  const best = resume.experience[0]?.bullets[0];
  const second = resume.experience[0]?.bullets[1];
  const paragraphs = [
    {
      text: job
        ? `I'm applying for the ${job.title} role at ${job.company}. ${
            role ? `In my work as ${role.title} at ${role.company}, I've built` : "I bring"
          } experience that lines up closely with what your team is looking for.`
        : `I'm a ${profile.headline || "professional"}${role ? `, currently working as ${role.title} at ${role.company}` : ""}, and I'm excited to bring my experience to your team.`,
      evidenceIds: role ? [role.id] : ["summary"],
    },
    ...(best && role
      ? [
          {
            text: `One result I'm proud of: I ${lowerFirst(sentence(best))}${second ? ` I also ${lowerFirst(sentence(second))}` : ""}`,
            evidenceIds: [idOf(best) ?? role.id, ...(second ? [idOf(second) ?? role.id] : [])],
          },
        ]
      : []),
    ...(profile.summary ? [{ text: sentence(profile.summary), evidenceIds: ["summary"] }] : []),
    {
      text: `Thank you for considering my application. I'd be glad to talk about how I can contribute to ${job?.company || "your team"}.`,
      evidenceIds: role ? [role.id] : ["summary"],
    },
  ];
  const trimmed = tone === "CONCISE" || mode === "shorten" ? [paragraphs[0]!, paragraphs.at(-1)!] : paragraphs;
  return { paragraphs: trimmed, organizationsMentioned: role ? [role.company] : [] };
}

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const sentence = (s: string) => s.trim().replace(/[.;,]?$/, ".");
