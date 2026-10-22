import { z } from "zod/v4";
import type { ProfileSnapshot } from "@/server/domain/profile";
import type { CoverLetterDocument, ResumeDocument } from "@/server/documents/model";
import { displayUrl, locationOf } from "@/server/documents/model";
import { buildEvidence, claimableTerms, evidenceBlock } from "../evidence";
import { inventedNumbers, overlongYears, unknownEvidence, unknownOrganizations } from "../guard/fabrication-guard";
import { normalize } from "../text";
import { GROUNDING_RULES, wrapJob, type WorkflowDefinition } from "../workflow";
import type { JobAnalysis } from "./job-analyzer";

export const TONES = ["PROFESSIONAL", "CONVERSATIONAL", "EXECUTIVE", "CONCISE", "ENTHUSIASTIC"] as const;
export type Tone = (typeof TONES)[number];

const TONE_GUIDE: Record<Tone, string> = {
  PROFESSIONAL: "Clear, confident and polite. 4 paragraphs, about 300–380 words (never over 400).",
  CONVERSATIONAL: "Warm and natural, like a thoughtful email. Contractions are fine. About 250–320 words.",
  EXECUTIVE: "Strategic and outcome-focused; emphasize leadership and business impact the evidence shows. About 300–380 words.",
  CONCISE: "Three short paragraphs, under 170 words. This is the one tone that is deliberately shorter than a full letter.",
  ENTHUSIASTIC: "Energetic and positive without exclamation-mark overload. About 250–330 words.",
};

/** How a strong letter is written, shared by the job letter and the Master letter. The thinking happens silently; only paragraphs are returned. */
const LETTER_CRAFT = `Before writing, think it through silently (never output the analysis):
- The job: the exact title, the most important responsibilities, what is required and what is only preferred, the skills, tools, methods and industry terms that are repeated or emphasized, and the problem the employer needs solved.
- The candidate: which two or three experiences, results and skills in the evidence answer those needs best. Relevance beats chronology; do not summarize the whole resume.
How to write it:
- Opening: name the exact position and give the single strongest, evidence-based reason the candidate fits, so the reader wants to continue. Avoid "I am writing to express my interest" when a stronger opening exists.
- Body: two or three of the strongest, most relevant experiences. Use measurable results (revenue, cost, time, conversion, users, team size, delivery) only when the evidence states them; never round up, add or estimate a number. Work in the skills, tools, platforms, methods, leadership and industry experience the employer asks for, only where the evidence supports them, naturally and without keyword stuffing.
- Industry: if the job needs a particular industry, use the candidate's real experience in it. Related experience may be shown as transferable, but never claim an industry the candidate did not work in.
- Why this role: connect the job description's own details (the work, the product, the customers it names) to the candidate. Use only what the job description says about the company; no generic praise ("I have always admired your company") and no outside knowledge of it.
- Value: say what the candidate can help the team accomplish, not what the candidate wants.
- Close: reinforce interest and the contribution in one or two sentences, offer to talk, and thank the reader. Confident, never desperate or presumptuous.
- If an important requirement is not in the evidence, do not imply it; lead with the closest real transferable experience instead.
- Sound human, specific and concise. Do not repeat the resume or the job description word for word. No buzzwords, clichés or piled-up adjectives.
- Check before answering: is it clearly for this role and company, are the strongest experiences first, are the employer's key terms present where true, does every claim come from the evidence, and is the length right? Fix anything that fails.`;

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
  paragraphs: z.array(z.object({ text: z.string(), evidenceIds: z.array(z.string()).catch([]) })).describe("3 to 5 paragraphs: opening, one or two on the strongest experience and results, why this role, a short close"),
  organizationsMentioned: z.array(z.string()).catch([]).describe("Every company, school or organization name you mentioned, other than the hiring company"),
});
export type CoverLetterOutput = z.infer<typeof CoverLetterSchema>;

function build(actionKey: "GENERATE_COVER_LETTER" | "EDIT_COVER_LETTER" | "MASTER_COVER_LETTER"): WorkflowDefinition<CoverLetterInput, CoverLetterOutput> {
  return {
    name: "cover_letter",
    promptVersion: "cover-letter@4",
    actionKey,
    schema: CoverLetterSchema,

    prompt: ({ profile, job, analysis, tone, mode, previous }) =>
      !job
        ? {
            system: `${GROUNDING_RULES}

Task: write the candidate's Master Cover Letter — a general letter for roles matching their title (${profile.headline || "their field"}) that they will adapt per job.
Tone: ${TONE_GUIDE[tone]}
- Do not name a company or a specific job. Refer to "your team" and "this role". There is no job description, so write for the kind of role the title points to and keep it easy to adapt.
${LETTER_CRAFT}
- Paragraph 1: who the candidate is and what they do best. Paragraphs 2–3: two or three strongest results from the evidence. Last: a short close.
- Do not write the greeting, sign-off or the candidate's name — the app adds them. Each paragraph cites evidence ids.`,
            user: `${previous?.length ? `<current_letter>\n${previous.join("\n\n")}\n</current_letter>\n\n` : ""}${evidenceBlock(buildEvidence(profile))}`,
          }
        : {
      system: `${GROUNDING_RULES}

Task: ${mode === "generate" ? "write a cover letter" : mode === "shorten" ? "shorten this cover letter by about a third" : mode === "expand" ? "expand this cover letter with more relevant evidence" : `rewrite this cover letter in a ${tone.toLowerCase()} tone`} for the job below.
Tone: ${TONE_GUIDE[tone]}
${LETTER_CRAFT}
- Paragraph 1: the role and a specific, evidence-based reason the candidate fits. Paragraphs 2–3: the strongest matching experiences. Last: why this role and a short close.
- If the candidate lacks direct experience but has strong transferable experience, say so positively and truthfully; never pretend it is a direct match. Never claim an industry, tool or requirement the evidence does not show.
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

    sanitize: (input, out) => sanitizeLetter(input, out),

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

/**
 * Keeps the paragraphs that cite real evidence and say nothing the evidence doesn't show (no unsupported numbers, no organization
 * outside the profile and the hiring company). If fewer than two paragraphs survive, the letter is the plain template that only
 * restates profile facts: a short honest letter is better than a refund and an error.
 */
export function sanitizeLetter(input: CoverLetterInput, out: CoverLetterOutput): CoverLetterOutput {
  const { profile, job } = input;
  const evidence = buildEvidence(profile);
  const known = new Set(evidence.map((e) => e.id));
  const tools = claimableTerms(profile);
  const orgs = new Set([...profile.experiences.map((e) => e.company), ...profile.education.map((e) => e.school), ...profile.certifications.flatMap((c) => [c.name, c.issuer ?? ""]), ...(job ? [job.company] : [])].filter(Boolean).map(normalize));
  // A name the model lists as an organization but that is really a tool or skill the candidate lists is not an invented employer.
  const unknownOrgs = out.organizationsMentioned.filter((o) => !orgs.has(normalize(o)) && !tools.has(o.trim().toLowerCase()));
  const paragraphs = out.paragraphs
    .flatMap((p) => {
      const evidenceIds = [...new Set(p.evidenceIds.filter((id) => known.has(id)))];
      const text = p.text.trim();
      const cited = [{ text, evidenceIds, where: "" }];
      const mentionsUnknownOrg = unknownOrgs.some((o) => normalize(text).includes(normalize(o)));
      return text && evidenceIds.length > 0 && !mentionsUnknownOrg && inventedNumbers(cited, evidence).length === 0 && overlongYears(cited, evidence, profile).length === 0 ? [{ text, evidenceIds }] : [];
    })
    .slice(0, 6);
  if (paragraphs.length < 2) return templateLetter(input);
  return { paragraphs, organizationsMentioned: out.organizationsMentioned.filter((o) => !unknownOrgs.includes(o)) };
}

export const coverLetterGenerator = build("GENERATE_COVER_LETTER");
export const coverLetterEditor = build("EDIT_COVER_LETTER"); // shorten / expand / retone — mode comes from input
export const masterCoverLetter = build("MASTER_COVER_LETTER");

export function toCoverLetterDocument(input: CoverLetterInput, out: CoverLetterOutput, today = new Date()): CoverLetterDocument {
  const name = `${input.profile.firstName} ${input.profile.lastName}`.trim();
  return {
    sender: {
      name,
      email: input.profile.email,
      phone: input.profile.phone,
      location: locationOf(input.profile),
      links: (["linkedin", "portfolio"] as const).flatMap((k) => (input.profile.links[k] ? [displayUrl(input.profile.links[k]!)] : [])),
    },
    recipient: { company: input.job?.company ?? "", jobTitle: input.job?.title ?? "" },
    date: today.toISOString().slice(0, 10),
    greeting: "Dear Hiring Manager,", // no hiring manager is ever invented; the company sits in the recipient block
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
