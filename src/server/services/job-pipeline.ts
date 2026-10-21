import "server-only";
import {
  atsChecker,
  buildMatchReport,
  candidateMatch,
  coverLetterEditor,
  coverLetterGenerator,
  jobAnalyzer,
  resumeOptimizer,
  runWorkflow,
  scoreAts,
  toCoverLetterDocument,
  toResumeDraft,
  type Tone,
} from "@/server/ai";
import type { CoverLetterMode } from "@/server/ai/workflows/cover-letter";
import { masterCoverLetter } from "@/server/ai/workflows/cover-letter";
import { buildCareerAnalysis } from "@/server/ai/experience";
import { changeNotesOf, masterResume } from "@/server/ai/workflows/resume-optimizer";
import { assembleResume, resumeFromProfile, type CoverLetterDocument, type ResumeDocument } from "@/server/documents/model";
import type { AppStore } from "@/server/store/types";

/**
 * The application pipeline, following the product flow:
 *   profile → Master Resume + Master Cover Letter
 *   job → Analyze Job (analysis + match) → Create Application (tailored resume + cover letter) → review/edit → download
 * The Master Profile and Master documents are only ever READ by job steps; every job gets its own versions.
 */

export class PipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineError";
  }
}

const ctx = (store: AppStore, userId: string, jobId: string | null, requestId: string) => ({ userId, jobId, requestId, credits: store.credits, runs: store.aiRuns });
const current = <T extends { versions: Array<{ id: string }>; currentVersionId: string }>(r: T | null) =>
  (r?.versions.find((v) => v.id === r.currentVersionId) as T["versions"][number] | undefined) ?? null;

async function loadJob(store: AppStore, userId: string, jobId: string) {
  const job = await store.getJob(userId, jobId);
  if (!job) throw new PipelineError("We couldn't find that job.");
  return job;
}

/** "Delete application": removes one job and everything created for it. Master documents and the profile are never touched. */
export async function deleteApplication(store: AppStore, userId: string, jobId: string) {
  await loadJob(store, userId, jobId);
  await store.deleteJob(userId, jobId);
}

// ───────────── Master documents ─────────────

/** Runs after the profile is created or updated. Free by default (configurable in CreditAction). */
export async function generateMasterDocuments(store: AppStore, userId: string, requestId: string) {
  const profile = await store.getProfile(userId);
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const { output } = await runWorkflow(masterResume, { profile }, ctx(store, userId, null, `${requestId}:resume`));
  const resume = { ...assembleResume(profile, toResumeDraft(output)), analysis: buildCareerAnalysis(profile, output.career) };
  await store.addResumeVersion(userId, null, { label: "AI_OPTIMIZED", content: resume, changeNotes: changeNotesOf(output), name: `${name} — Master Resume` });

  const input = { profile, resume, job: null, analysis: null, tone: "PROFESSIONAL" as Tone, mode: "generate" as const };
  const letter = await runWorkflow(masterCoverLetter, input, ctx(store, userId, null, `${requestId}:letter`));
  await store.addCoverLetterVersion(userId, null, { label: "AI_OPTIMIZED", content: toCoverLetterDocument(input, letter.output), tone: "PROFESSIONAL", name: `${name} — Master Cover Letter` });
}

// ───────────── Job steps ─────────────

export async function createJob(store: AppStore, userId: string, input: { title: string; company: string; location?: string; url?: string; description: string }) {
  return store.createJob(userId, {
    title: input.title || "Untitled role",
    company: input.company || "Company",
    location: input.location || null,
    url: input.url || null,
    description: input.description,
  });
}

/** "Analyze Job": read the job, then compare it with the profile + Master Resume. Two metered steps. */
export async function analyzeJob(store: AppStore, userId: string, jobId: string, requestId: string) {
  const job = await loadJob(store, userId, jobId);
  const analysis = await runWorkflow(jobAnalyzer, job, ctx(store, userId, jobId, requestId));
  await store.saveAnalysis(userId, { jobId, result: analysis.output, promptVersion: jobAnalyzer.promptVersion, aiRunId: analysis.run.id });
  await store.setJobStatus(userId, jobId, "ANALYZED");
  await checkMatch(store, userId, jobId, requestId);
}

/** Re-run the comparison (e.g. after answering gap questions). */
export async function checkMatch(store: AppStore, userId: string, jobId: string, requestId: string) {
  const analysis = await store.latestAnalysis(userId, jobId);
  if (!analysis) throw new PipelineError("Analyze the job first.");
  const profile = await store.getProfile(userId);
  const input = { profile, analysis: analysis.result };
  const { output, run } = await runWorkflow(candidateMatch, input, ctx(store, userId, jobId, requestId));
  const report = buildMatchReport(input, output);
  await store.saveMatch(userId, { jobId, kind: "JOB_MATCH", overallScore: report.scores.overall, result: report, aiRunId: run.id });
  await store.setJobStatus(userId, jobId, "MATCHED");
}

/** Yes → the user's own words become an approved fact. No → remembered so it's never claimed or asked again. */
export async function answerGapQuestion(store: AppStore, userId: string, jobId: string, q: { topic: string; question: string; answer: "yes" | "no"; detail?: string }) {
  await loadJob(store, userId, jobId);
  const detail = q.detail?.trim();
  if (q.answer === "yes" && !detail) throw new PipelineError("Add a sentence about your experience so we can use it accurately.");
  await store.addApprovedFact(userId, { jobId, topic: q.topic, question: q.question, answer: q.answer === "yes" ? detail! : null, status: q.answer === "yes" ? "APPROVED" : "DECLINED" });
}

/** "Create Application": tailored resume, then tailored cover letter built on it. */
export async function createApplication(store: AppStore, userId: string, jobId: string, requestId: string, tone: Tone = "PROFESSIONAL") {
  await optimizeResume(store, userId, jobId, requestId);
  await writeCoverLetter(store, userId, jobId, requestId, tone, "generate");
}

export async function optimizeResume(store: AppStore, userId: string, jobId: string, requestId: string, improvementNotes?: string[]) {
  const job = await loadJob(store, userId, jobId);
  const analysis = await store.latestAnalysis(userId, jobId);
  const match = await store.latestMatch(userId, jobId);
  if (!analysis || !match) throw new PipelineError("Analyze the job first.");
  const profile = await store.getProfile(userId);
  const name = `${profile.firstName} ${profile.lastName} — ${job.title}, ${job.company}`;

  // Version 1 of every job resume is a copy of the Master Resume, so the user can compare and go back.
  if (!(await store.resumeForJob(userId, jobId))) {
    const master = current(await store.resumeForJob(userId, null));
    await store.addResumeVersion(userId, jobId, {
      label: "ORIGINAL",
      // The career analysis belongs to the Master Resume only; a job's resume is a document, not an analysis.
      content: master ? (({ analysis: _analysis, ...doc }) => structuredClone(doc))(master.content) : resumeFromProfile(profile),
      changeNotes: [master ? "Copy of your Master Resume" : "Built from your profile"],
      name,
    });
  }
  const { output } = await runWorkflow(resumeOptimizer, { profile, job, analysis: analysis.result, match: match.result, improvementNotes }, ctx(store, userId, jobId, `${requestId}:resume`));
  await store.addResumeVersion(userId, jobId, { label: "AI_OPTIMIZED", content: assembleResume(profile, toResumeDraft(output)), changeNotes: changeNotesOf(output), name });
  await store.setJobStatus(userId, jobId, "OPTIMIZED");
}

export async function writeCoverLetter(store: AppStore, userId: string, jobId: string, requestId: string, tone: Tone, mode: CoverLetterMode) {
  const job = await loadJob(store, userId, jobId);
  const analysis = await store.latestAnalysis(userId, jobId);
  const resume = current(await store.resumeForJob(userId, jobId));
  if (!resume) throw new PipelineError("Create your application first.");
  const profile = await store.getProfile(userId);
  const previous = current(await store.coverLetterForJob(userId, jobId))?.content.paragraphs;
  if (mode !== "generate" && !previous) throw new PipelineError("Write a cover letter first.");

  const input = { profile, resume: resume.content, job, analysis: analysis?.result ?? null, tone, mode, previous };
  const { output } = await runWorkflow(mode === "generate" ? coverLetterGenerator : coverLetterEditor, input, ctx(store, userId, jobId, `${requestId}:letter`));
  await store.addCoverLetterVersion(userId, jobId, { label: "AI_OPTIMIZED", content: toCoverLetterDocument(input, output), tone, name: `Cover letter — ${job.title}, ${job.company}` });
  await store.setJobStatus(userId, jobId, "READY");
}

export async function runAtsCheck(store: AppStore, userId: string, jobId: string, requestId: string) {
  const analysis = await store.latestAnalysis(userId, jobId);
  const match = await store.latestMatch(userId, jobId);
  const version = current(await store.resumeForJob(userId, jobId));
  if (!analysis || !match || !version) throw new PipelineError("Create your application first.");
  const scores = scoreAts(version.content, analysis.result, match.result);
  const { output, run } = await runWorkflow(atsChecker, { resume: version.content, analysis: analysis.result, match: match.result, scores }, ctx(store, userId, jobId, requestId));
  await store.saveAts(userId, { jobId, kind: "ATS", resumeVersionId: version.id, overallScore: scores.overall, result: { scores, advice: output }, aiRunId: run.id });
}

// ───────────── User edits (the user's own words — saved as a new version, never overwriting) ─────────────

export interface ResumeEdits {
  headline: string;
  summary: string;
  experience: Array<{ sourceId: string; bullets: string[] }>;
  skills: string[];
  /** Absent when the form did not offer the field (older resumes keep theirs untouched). */
  competencies?: string[];
  projects: Array<{ sourceId: string; description: string }>;
}

/**
 * Wording is editable here; facts (employer, title, dates, school) stay as in the profile —
 * those are changed on the Profile page, so every document stays consistent.
 */
export async function saveResumeEdits(store: AppStore, userId: string, jobId: string | null, edits: ResumeEdits) {
  const record = await store.resumeForJob(userId, jobId);
  const version = current(record);
  if (!record || !version) throw new PipelineError("There's no resume to edit yet.");
  const bullets = new Map(edits.experience.map((e) => [e.sourceId, e.bullets]));
  const projects = new Map(edits.projects.map((p) => [p.sourceId, p.description]));
  const content: ResumeDocument = {
    ...version.content,
    header: { ...version.content.header, headline: edits.headline },
    summary: edits.summary,
    experience: version.content.experience.map((e) => ({ ...e, bullets: bullets.get(e.sourceId) ?? e.bullets })),
    skills: edits.skills,
    ...(edits.competencies ? { competencies: edits.competencies } : {}),
    projects: version.content.projects.map((p) => ({ ...p, description: projects.get(p.sourceId) ?? p.description })),
  };
  await store.addResumeVersion(userId, jobId, { label: "USER_EDITED", content, changeNotes: ["Your edits"], name: record.name });
}

export async function saveCoverLetterEdits(store: AppStore, userId: string, jobId: string | null, edits: Pick<CoverLetterDocument, "greeting" | "paragraphs" | "closing">) {
  const record = await store.coverLetterForJob(userId, jobId);
  const version = current(record);
  if (!record || !version) throw new PipelineError("There's no cover letter to edit yet.");
  await store.addCoverLetterVersion(userId, jobId, { label: "USER_EDITED", content: { ...version.content, ...edits }, tone: version.tone, name: record.name });
}
