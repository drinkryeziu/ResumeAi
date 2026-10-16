import "server-only";
import type { JobFlowStepKey } from "@/components/features/job-flow/StepProgress";
import type { AppStore } from "@/server/store/types";

/** Read-models for pages. Pages render; these decide what to load. */

export async function jobSummaries(store: AppStore, userId: string) {
  const jobs = await store.listJobs(userId);
  return Promise.all(
    jobs.map(async (job) => {
      const [match, ats, resume, letter] = await Promise.all([
        store.latestMatch(userId, job.id),
        store.latestAts(userId, job.id),
        store.resumeForJob(userId, job.id),
        store.coverLetterForJob(userId, job.id),
      ]);
      return { job, matchScore: match?.overallScore ?? null, atsScore: ats?.overallScore ?? null, hasResume: Boolean(resume), hasLetter: Boolean(letter) };
    }),
  );
}

export const STATUS_LABEL = {
  DRAFT: "Draft",
  ANALYZED: "Job analyzed",
  MATCHED: "Match checked",
  OPTIMIZED: "Resume ready",
  READY: "Application ready",
} as const;

export async function jobProgress(store: AppStore, userId: string, jobId: string) {
  const [job, analysis, match, resume, letter, ats] = await Promise.all([
    store.getJob(userId, jobId),
    store.latestAnalysis(userId, jobId),
    store.latestMatch(userId, jobId),
    store.resumeForJob(userId, jobId),
    store.coverLetterForJob(userId, jobId),
    store.latestAts(userId, jobId),
  ]);
  const completed: JobFlowStepKey[] = ["add"];
  if (match) completed.push("match");
  if (resume?.versions.some((v) => v.label === "AI_OPTIMIZED") && letter) completed.push("create");
  return { job, analysis, match, resume, letter, ats, completed };
}
