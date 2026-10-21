"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { TONES, WorkflowOutputError } from "@/server/ai";
import { describeAIError } from "@/server/ai/errors";
import { AIProviderError } from "@/server/ai/providers/types";
import { requireUser } from "@/server/auth/session";
import { InsufficientCreditsError } from "@/server/credits/types";
import { extractText, UploadError } from "@/server/documents/extract-text";
import { notice } from "@/lib/notices";
import { overLimit, RULES } from "@/server/security/rate-limit";
import { describeCreditStop, type CreditStop } from "@/server/services/credit-stop";
import * as pipeline from "@/server/services/job-pipeline";
import { getStore } from "@/server/store";

export type ActionState = { error?: string; needCredits?: boolean; creditStop?: CreditStop; ok?: string } | undefined;

/**
 * Typed errors → the plain-language messages users see. Internals never leak. Running out of credits is not a failure: the
 * state carries what is really saved (read back from the store) so the page can show the credit-limit window.
 */
async function toState(err: unknown, who?: { userId: string; jobId: string | null }): Promise<ActionState> {
  if (err instanceof InsufficientCreditsError) {
    const creditStop = who ? await describeCreditStop(await getStore(), who.userId, who.jobId, err) : undefined;
    return { error: err.message, needCredits: true, creditStop };
  }
  if (err instanceof pipeline.PipelineError || err instanceof WorkflowOutputError || err instanceof UploadError) return { error: err.message };
  if (err instanceof AIProviderError) return { error: `${describeAIError(err, "finish that")} Your credits were refunded.` };
  console.error("[jobs/actions]", err);
  return { error: "Something went wrong. Any credits used were refunded." };
}

/** AI actions cost real money; credits limit them, this stops a runaway loop. */
const TOO_FAST: ActionState = { error: "You're going fast. Please wait a few minutes before the next AI action." };
const tooFast = async (userId: string) => overLimit(await getStore(), RULES.aiUser, userId);

const requestId = (fd: FormData) => String(fd.get("requestId") || crypto.randomUUID());
/** "master" addresses the Master Resume / Cover Letter (jobId null). */
const targetOf = (fd: FormData) => {
  const v = z.string().min(1).parse(fd.get("jobId"));
  return v === "master" ? null : v;
};
const pathOf = (jobId: string | null) => (jobId ? `/jobs/${jobId}` : "/master");
/** A document opened from the Documents tab keeps its "Close" button after a save or restore. */
const fromOf = (fd: FormData) => (fd.get("from") === "documents" ? "&from=documents" : "");

const JobFields = z.object({
  title: z.string().trim().max(200).default(""),
  company: z.string().trim().max(200).default(""),
  location: z.string().trim().max(200).optional(),
  url: z.union([z.literal(""), z.url().max(2000)]).optional(),
  description: z.string().trim().max(30_000, "That description is too long — trim it to under 30,000 characters.").default(""),
});

/** Step 1 → 2: save the job (pasted or uploaded), then Analyze Job = analysis + match. */
export async function analyzeNewJob(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (await tooFast(user.id)) return TOO_FAST;
  const parsed = JobFields.safeParse({ ...Object.fromEntries(fd), file: undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const store = await getStore();
  let jobId: string | null = null;
  try {
    let description = parsed.data.description;
    const file = fd.get("file");
    if (!description && file instanceof File && file.size > 0) description = await extractText(file);
    if (description.length < 200) return { error: "Paste the full job description or upload it as a file (at least a few paragraphs)." };
    const job = await pipeline.createJob(store, user.id, { ...parsed.data, description });
    jobId = job.id;
    await pipeline.analyzeJob(store, user.id, jobId, requestId(fd));
  } catch (e) {
    return toState(e, { userId: user.id, jobId });
  }
  redirect(`/jobs/${jobId}/match?notice=${notice("job-analyzed")}`);
}

async function step(fd: FormData, run: (jobId: string, rid: string) => Promise<unknown>, next: (jobId: string) => string): Promise<ActionState> {
  const jobId = z.string().min(1).parse(fd.get("jobId"));
  const { id: userId } = await requireUser();
  if (await tooFast(userId)) return TOO_FAST;
  try {
    await run(jobId, requestId(fd));
  } catch (e) {
    return toState(e, { userId, jobId });
  }
  revalidatePath(`/jobs/${jobId}`, "layout");
  redirect(next(jobId));
}

const ToneField = z.enum(TONES).catch("PROFESSIONAL");

/** "Create Application": tailored resume + tailored cover letter. */
export async function createApplication(_: ActionState, fd: FormData) {
  const { id } = await requireUser();
  const store = await getStore();
  return step(
    fd,
    (jobId, rid) => pipeline.createApplication(store, id, jobId, rid, ToneField.parse(fd.get("tone"))),
    (j) => `/jobs/${j}?new=1&notice=${notice("application-created")}`,
  );
}

/** "Pick up where you left off": a saved job that was not fully analyzed. Only the steps still to do are run and paid for. */
export async function continueAnalysis(_: ActionState, fd: FormData) {
  const { id } = await requireUser();
  const store = await getStore();
  return step(
    fd,
    (jobId, rid) => pipeline.analyzeJob(store, id, jobId, rid),
    (j) => `/jobs/${j}/match?notice=${notice("job-analyzed")}`,
  );
}

export async function recheckMatch(_: ActionState, fd: FormData) {
  const { id } = await requireUser();
  const store = await getStore();
  return step(
    fd,
    (jobId, rid) => pipeline.checkMatch(store, id, jobId, rid),
    (j) => `/jobs/${j}/match?notice=${notice("match-updated")}`,
  );
}

export async function improveResume(_: ActionState, fd: FormData) {
  const { id } = await requireUser();
  const store = await getStore();
  const notes = fd.getAll("improve").map(String).filter(Boolean);
  return step(
    fd,
    (jobId, rid) => pipeline.optimizeResume(store, id, jobId, rid, notes.length ? notes : undefined),
    (j) => `/jobs/${j}?doc=resume&notice=${notice("resume-improved")}`,
  );
}

export async function runAtsCheck(_: ActionState, fd: FormData) {
  const { id } = await requireUser();
  const store = await getStore();
  return step(
    fd,
    (jobId, rid) => pipeline.runAtsCheck(store, id, jobId, rid),
    (j) => `/jobs/${j}?doc=resume&notice=${notice("ats-checked")}#ats`,
  );
}

const LetterInput = z.object({ tone: z.enum(TONES), mode: z.enum(["generate", "shorten", "expand", "retone"]) });

export async function rewriteCoverLetter(_: ActionState, fd: FormData) {
  const { id } = await requireUser();
  const store = await getStore();
  const parsed = LetterInput.safeParse({ tone: fd.get("tone"), mode: fd.get("mode") });
  if (!parsed.success) return { error: "Choose a tone." };
  return step(
    fd,
    (jobId, rid) => pipeline.writeCoverLetter(store, id, jobId, rid, parsed.data.tone, parsed.data.mode),
    (j) => `/jobs/${j}?doc=cover-letter&notice=${notice("letter-rewritten")}`,
  );
}

const Answer = z.object({ topic: z.string().min(1), question: z.string().min(1), answer: z.enum(["yes", "no"]), detail: z.string().max(600).optional() });

export async function answerQuestion(_: ActionState, fd: FormData): Promise<ActionState> {
  const { id } = await requireUser();
  const jobId = z.string().min(1).parse(fd.get("jobId"));
  const parsed = Answer.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Choose Yes or No." };
  try {
    await pipeline.answerGapQuestion(await getStore(), id, jobId, parsed.data);
  } catch (e) {
    return toState(e, { userId: id, jobId });
  }
  revalidatePath(`/jobs/${jobId}/match`);
  return { ok: parsed.data.answer === "yes" ? "Saved. We'll use this when we create your application." : "Got it — we won't include this." };
}

// ───────────── Editing (jobs and Master documents) ─────────────

const lines = z
  .string()
  .max(20_000)
  .transform((s) =>
    s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean),
  );

const commaList = z
  .string()
  .max(3000)
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );

const ResumeEdit = z.object({
  headline: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(3000),
  skills: commaList,
  competencies: commaList,
});

export async function saveResumeEdits(_: ActionState, fd: FormData): Promise<ActionState> {
  const { id } = await requireUser();
  const jobId = targetOf(fd);
  const parsed = ResumeEdit.safeParse({ headline: fd.get("headline"), summary: fd.get("summary"), skills: fd.get("skills"), competencies: fd.get("competencies") ?? "" });
  if (!parsed.success) return { error: "Your headline can't be empty." };
  const experience = fd.getAll("expId").map((sid) => ({ sourceId: String(sid), bullets: lines.parse(String(fd.get(`bullets:${sid}`) ?? "")) }));
  const projects = fd.getAll("projId").map((sid) => ({ sourceId: String(sid), description: String(fd.get(`project:${sid}`) ?? "").trim() }));
  try {
    const { competencies, ...rest } = parsed.data;
    await pipeline.saveResumeEdits(await getStore(), id, jobId, { ...rest, ...(fd.has("competencies") ? { competencies } : {}), experience, projects });
  } catch (e) {
    return toState(e, { userId: id, jobId });
  }
  revalidatePath(pathOf(jobId));
  redirect(`${pathOf(jobId)}?doc=resume&notice=${notice("version-saved")}${fromOf(fd)}`);
}

const LetterEdit = z.object({
  greeting: z.string().trim().min(1).max(200),
  body: z
    .string()
    .max(10_000)
    .transform((s) =>
      s
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
        .filter(Boolean),
    ),
  closing: z.string().trim().min(1).max(100),
});

export async function saveCoverLetterEdits(_: ActionState, fd: FormData): Promise<ActionState> {
  const { id } = await requireUser();
  const jobId = targetOf(fd);
  const parsed = LetterEdit.safeParse({ greeting: fd.get("greeting"), body: fd.get("body"), closing: fd.get("closing") });
  if (!parsed.success || parsed.data.body.length === 0) return { error: "Your letter needs a greeting, at least one paragraph and a closing." };
  try {
    await pipeline.saveCoverLetterEdits(await getStore(), id, jobId, { greeting: parsed.data.greeting, paragraphs: parsed.data.body, closing: parsed.data.closing });
  } catch (e) {
    return toState(e, { userId: id, jobId });
  }
  revalidatePath(pathOf(jobId));
  redirect(`${pathOf(jobId)}?doc=cover-letter&notice=${notice("version-saved")}${fromOf(fd)}`);
}

export async function restoreVersion(fd: FormData) {
  const { id } = await requireUser();
  const jobId = targetOf(fd);
  await (await getStore()).restoreResumeVersion(id, String(fd.get("resumeId")), String(fd.get("versionId")));
  revalidatePath(pathOf(jobId));
  redirect(`${pathOf(jobId)}?doc=resume&notice=${notice("version-restored")}${fromOf(fd)}`);
}

/** "Delete" on a document in the Documents tab, after the person confirms. */
export async function deleteDocument(fd: FormData) {
  const { id: userId } = await requireUser();
  const parsed = z.object({ kind: z.enum(["resume", "cover-letter"]), id: z.string().min(1).max(80) }).safeParse({ kind: fd.get("kind"), id: fd.get("id") });
  if (parsed.success) {
    try {
      await pipeline.deleteDocument(await getStore(), userId, parsed.data.kind, parsed.data.id);
    } catch (e) {
      if (!(e instanceof pipeline.PipelineError)) throw e; // already gone: just show the list again
    }
  }
  revalidatePath("/", "layout");
  redirect(`/documents?notice=${notice("document-deleted")}`);
}

/** The dashboard's "X" on an application, after the user confirms. Already deleted (or not theirs) just refreshes the list. */
export async function deleteApplication(fd: FormData) {
  const { id } = await requireUser();
  const jobId = z.string().min(1).parse(fd.get("jobId"));
  try {
    await pipeline.deleteApplication(await getStore(), id, jobId);
  } catch (e) {
    if (!(e instanceof pipeline.PipelineError)) throw e;
  }
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  redirect(`/dashboard?notice=${notice("application-deleted")}`);
}

export async function regenerateMasterDocuments(_: ActionState, fd: FormData): Promise<ActionState> {
  const { id } = await requireUser();
  if (await tooFast(id)) return TOO_FAST;
  try {
    await pipeline.generateMasterDocuments(await getStore(), id, requestId(fd));
  } catch (e) {
    return toState(e, { userId: id, jobId: null });
  }
  revalidatePath("/master");
  redirect(`/master?notice=${notice("masters-updated")}`);
}
