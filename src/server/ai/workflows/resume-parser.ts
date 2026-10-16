import { z } from "zod/v4";
import { normalize } from "../text";
import { GROUNDING_RULES, type WorkflowDefinition } from "../workflow";

/**
 * Reads an uploaded CV into a profile draft. Nothing is saved until the user reviews and saves it
 * (REVIEW → EDIT → APPROVE → SAVE). Every item quotes the line it came from, and the guard rejects
 * any quote or skill that is not actually in the uploaded text — the parser can't invent anything.
 */

const Src = { source: z.string().describe("The exact line from the CV this item was read from") };

export const ProfileDraftSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  headline: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  summary: z.string().nullable(),
  experiences: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      location: z.string().nullable(),
      startDate: z.string().nullable().describe("YYYY-MM; null if the month or year is not written"),
      endDate: z.string().nullable(),
      isCurrent: z.boolean(),
      bullets: z.array(z.string()).describe("Copied as written"),
      tools: z.array(z.string()),
      ...Src,
    }),
  ),
  education: z.array(z.object({ school: z.string(), degree: z.string().nullable(), field: z.string().nullable(), endDate: z.string().nullable(), ...Src })),
  skills: z.array(z.object({ name: z.string(), category: z.enum(["PROFESSIONAL", "TECHNICAL", "TOOL", "DOMAIN", "SOFT"]) })),
  certifications: z.array(z.object({ name: z.string(), issuer: z.string().nullable(), issueDate: z.string().nullable(), ...Src })),
  projects: z.array(z.object({ name: z.string(), description: z.string().nullable(), ...Src })),
  languages: z.array(z.string()),
});
export type ProfileDraft = z.infer<typeof ProfileDraftSchema>;

export const resumeParser: WorkflowDefinition<{ text: string }, ProfileDraft> = {
  name: "resume_parser",
  promptVersion: "resume-parser@2",
  actionKey: "PARSE_RESUME",
  schema: ProfileDraftSchema,
  prompt: ({ text }) => ({
    system: `${GROUNDING_RULES}

Task: read the candidate's CV text into the structure, so it can pre-fill their profile for them to review.
- Copy facts exactly; do not improve wording, guess dates or fill gaps. Unknown → null. Dates as YYYY-MM only when month and year are written.
- Every experience, education, certification and project quotes its "source" line verbatim (usually the line with the title or name).
- Only list skills and languages that are written in the CV.`,
    user: `<resume_text>\n${text.slice(0, 40_000)}\n</resume_text>`,
  }),
  mock: ({ text }) => heuristicParse(text),
  check: ({ text }, out) => {
    const hay = normalize(text);
    const v: string[] = [];
    for (const it of [...out.experiences, ...out.education, ...out.certifications, ...out.projects]) {
      if (!hay.includes(normalize(it.source).slice(0, 60))) v.push(`"${it.source.slice(0, 60)}" is not in the CV text.`);
    }
    for (const s of out.skills) if (!hay.includes(normalize(s.name))) v.push(`skill "${s.name}" is not written in the CV.`);
    for (const l of out.languages) if (!hay.includes(normalize(l))) v.push(`language "${l}" is not written in the CV.`);
    return v;
  },
};

// ───────────── Rule-based reader (no API key): handles common single-column CV layouts ─────────────

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH = String.raw`(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?`;
const DATE = String.raw`(?:${MONTH}\s+\d{4}|\d{1,2}\/\d{4}|\d{4})`;
const RANGE = new RegExp(String.raw`(${DATE})\s*(?:–|—|-|to)\s*(present|current|now|${DATE})\s*$`, "i");
const SINGLE_DATE = new RegExp(String.raw`\(?(${DATE})\)?\s*$`, "i");

const SECTIONS: Record<string, string> = {
  summary: "summary", profile: "summary", "professional summary": "summary", about: "summary", "about me": "summary", objective: "summary",
  experience: "experience", "work experience": "experience", "professional experience": "experience", employment: "experience", "employment history": "experience", "work history": "experience",
  education: "education", skills: "skills", "technical skills": "skills", "core skills": "skills", "key skills": "skills", competencies: "skills",
  certifications: "certifications", certificates: "certifications", licenses: "certifications", "licenses & certifications": "certifications",
  projects: "projects", languages: "languages",
};

/** "Mar 2021" → "2021-03", "03/2021" → "2021-03"; a bare year gives no month → null (the user fills it in). */
function toMonth(d: string | undefined): string | null {
  if (!d) return null;
  const s = d.trim().toLowerCase();
  const slash = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[2]}-${slash[1]!.padStart(2, "0")}`;
  const named = s.match(/^([a-z]+)\.?\s+(\d{4})$/);
  if (named) {
    const m = MONTHS.indexOf(named[1]!.slice(0, 3));
    return m >= 0 ? `${named[2]}-${String(m + 1).padStart(2, "0")}` : null;
  }
  return null;
}

const splitList = (s: string) => s.split(/\s*(?:,|·|•|\||;)\s*/).map((x) => x.trim()).filter((x) => x.length > 1 && x.length < 60);
const isBullet = (l: string) => /^[•\-*–▪●◦]\s*/.test(l);
const stripBullet = (l: string) => l.replace(/^[•\-*–▪●◦]\s*/, "").trim();
const looksLikeLocation = (l: string) => l.length < 45 && (/^remote$/i.test(l) || /^[A-Z][A-Za-z .'-]+,\s*[A-Z][A-Za-z .]+$/.test(l));

function heuristicParse(text: string): ProfileDraft {
  const lines = text.split(/\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const draft: ProfileDraft = {
    firstName: null, lastName: null, headline: null, email: null, phone: null, location: null, links: [], summary: null,
    experiences: [], education: [], skills: [], certifications: [], projects: [], languages: [],
  };

  // Header: name, headline, contact line(s) — everything before the first section heading.
  const sectionOf = (l: string) => SECTIONS[l.toLowerCase().replace(/[:]/g, "").trim()];
  const firstSection = lines.findIndex((l) => sectionOf(l));
  const header = lines.slice(0, firstSection < 0 ? 3 : firstSection);
  const [first, ...rest] = (header[0] ?? "").split(" ");
  if (header[0] && header[0].length < 50 && !/[@\d]/.test(header[0])) {
    draft.firstName = first ?? null;
    draft.lastName = rest.join(" ") || null;
  }
  if (header[1] && header[1].length < 70 && !/[@]|\d{3}/.test(header[1])) draft.headline = header[1];
  draft.email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? null;
  draft.phone = text.match(/\+?\(?\d{1,4}\)?[\d\s().-]{7,}\d/)?.[0]?.trim() ?? null;
  for (const m of text.matchAll(/(?:https?:\/\/)?(?:www\.)?((?:linkedin\.com|github\.com|behance\.net|dribbble\.com)\/[^\s·,|]+)/gi)) {
    const url = `https://${m[1]}`;
    if (!draft.links.some((l) => l.url === url)) draft.links.push({ label: m[1]!.split(".")[0]!, url });
  }
  const contact = header.find((l) => l.includes("@"));
  const loc = contact?.split(/\s*[·|•]\s*/).find((p) => /^[A-Z][A-Za-z .'-]+,\s*[A-Z]/.test(p) && !p.includes("@"));
  draft.location = loc ?? null;

  // Sections
  let section: string | null = null;
  let cur: ProfileDraft["experiences"][number] | null = null;
  let proj: ProfileDraft["projects"][number] | null = null;
  const summary: string[] = [];
  for (const line of lines.slice(firstSection < 0 ? lines.length : firstSection)) {
    const sec = sectionOf(line);
    if (sec) {
      section = sec;
      cur = null;
      proj = null;
      continue;
    }
    if (section === "summary") summary.push(line);
    else if (section === "experience") {
      const range = line.match(RANGE);
      if (range && line.length < 140) {
        const head = line.slice(0, range.index).replace(/[|,–—-]\s*$/, "").trim();
        const [a, b] = head.split(/\s*(?:,| at | \| | — | – )\s*/);
        const current = /present|current|now/i.test(range[2]!);
        cur = { company: (b ?? "").trim(), title: (a ?? head).trim(), location: null, startDate: toMonth(range[1]), endDate: current ? null : toMonth(range[2]), isCurrent: current, bullets: [], tools: [], source: line };
        draft.experiences.push(cur);
      } else if (cur && !cur.location && cur.bullets.length === 0 && looksLikeLocation(line)) {
        cur.location = line;
      } else if (cur) {
        if (isBullet(line) || cur.bullets.length === 0 || /^[A-Z]/.test(line)) cur.bullets.push(stripBullet(line));
        else cur.bullets[cur.bullets.length - 1] += ` ${line}`; // wrapped line
      }
    } else if (section === "education") {
      const date = line.match(SINGLE_DATE);
      const body = date ? line.slice(0, date.index).trim().replace(/[,(]\s*$/, "") : line;
      const parts = body.split(/\s*,\s*/);
      const school = parts.find((p) => /university|college|institute|school|academy|polytechnic/i.test(p)) ?? parts.at(-1) ?? body;
      const degree = parts.find((p) => p !== school && /^(b\.?a|b\.?s|bsc|ba|bs|m\.?a|m\.?s|msc|mba|ph\.?d|bachelor|master|associate|diploma|doctor)/i.test(p)) ?? null;
      const field = parts.find((p) => p !== school && p !== degree) ?? null;
      if (school.length > 3) draft.education.push({ school, degree, field, endDate: toMonth(date?.[1]), source: line });
    } else if (section === "skills") {
      const items = splitList(line.replace(/^[^:]{2,30}:\s*/, ""));
      for (const name of items) if (!draft.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) draft.skills.push({ name, category: "PROFESSIONAL" });
    } else if (section === "certifications") {
      const date = line.match(SINGLE_DATE);
      const body = stripBullet(date ? line.slice(0, date.index).trim().replace(/[,(]\s*$/, "") : line);
      const [name, ...issuer] = body.split(/\s*(?:,| — | – | - )\s*/);
      if (name) draft.certifications.push({ name, issuer: issuer.join(", ") || null, issueDate: toMonth(date?.[1]), source: line });
    } else if (section === "projects") {
      if (!proj || (line.length < 60 && !/[.]$/.test(line) && proj.description)) {
        proj = { name: stripBullet(line), description: null, source: line };
        draft.projects.push(proj);
      } else proj.description = proj.description ? `${proj.description} ${line}` : line;
    } else if (section === "languages") {
      for (const l of splitList(line)) draft.languages.push(l);
    }
  }
  draft.summary = summary.join(" ") || null;
  return draft;
}
