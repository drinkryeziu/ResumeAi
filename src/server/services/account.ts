import type { AppStore } from "@/server/store/types";

/**
 * Everything ResumeAi holds about one person, as plain JSON they can keep. Never includes the password hash.
 */
export async function exportAccountData(store: AppStore, userId: string, now = new Date()) {
  const user = await store.getUser(userId);
  if (!user) return null;
  const jobs = await store.listJobs(userId);
  const [profile, cvImport, masterResume, masterCoverLetter, balance, history, aiRuns, errorLog] = await Promise.all([
    store.findProfile(userId),
    store.getCvImport(userId),
    store.resumeForJob(userId, null),
    store.coverLetterForJob(userId, null),
    store.credits.balance(userId),
    store.credits.history(userId, 100_000),
    store.aiRuns.listForUser(userId),
    store.listErrorsForUser(userId),
  ]);
  const applications = await Promise.all(
    jobs.map(async (job) => {
      const [analysis, match, ats, resume, coverLetter] = await Promise.all([
        store.latestAnalysis(userId, job.id),
        store.latestMatch(userId, job.id),
        store.latestAts(userId, job.id),
        store.resumeForJob(userId, job.id),
        store.coverLetterForJob(userId, job.id),
      ]);
      return { job, analysis, match, ats, resume, coverLetter };
    }),
  );
  return {
    exportedAt: now.toISOString(),
    note: "Everything ResumeAi holds about you. Resumes and cover letters include every saved version.",
    account: { name: user.name, email: user.email, createdAt: user.createdAt },
    profile,
    pendingCvImport: cvImport,
    masterResume,
    masterCoverLetter,
    applications,
    credits: { balance, history },
    aiActions: aiRuns,
    errorLog, // the problems the site noted when something failed for you (messages never include your documents)
  };
}

/**
 * Deletes the account and everything of the person's. They must type their own email address first, so a stray
 * click (or someone using an unattended browser tab) can't wipe an account. Returns false when the address doesn't match.
 */
export async function deleteAccount(store: AppStore, userId: string, typedEmail: string): Promise<boolean> {
  const user = await store.getUser(userId);
  if (!user || typedEmail.trim().toLowerCase() !== user.email) return false;
  await store.deleteAccount(userId);
  return true;
}
