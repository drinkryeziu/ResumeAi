"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resumeParser, runWorkflow, WorkflowOutputError } from "@/server/ai";
import { aiAvailable } from "@/server/ai/providers/registry";
import { describeAIError } from "@/server/ai/errors";
import { AIProviderError } from "@/server/ai/providers/types";
import { notice } from "@/lib/notices";
import { extractText, UploadError } from "@/server/documents/extract-text";
import { requireUser } from "@/server/auth/session";
import { overLimit, RULES } from "@/server/security/rate-limit";
import { toProfileSnapshot } from "@/server/domain/profile-mapping";
import { ProfileInputSchema } from "@/server/domain/profile-schema";
import { generateMasterDocuments } from "@/server/services/job-pipeline";
import { getStore } from "@/server/store";

const NO_AI = "AI writing isn't switched on for this site yet, so your Master documents can't be created. The site owner needs to add the AI key.";

export type ProfileState = { error?: string } | undefined;

/**
 * Saves the Master Profile. On first save — or when the user asks — it then (re)generates the
 * Master Resume and Master Cover Letter as new versions (older versions stay in history).
 */
export async function saveProfile(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await requireUser();
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("profile") ?? ""));
  } catch {
    return { error: "We couldn't read the form. Please try again." };
  }
  const parsed = ProfileInputSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  if (parsed.data.experiences.length === 0) return { error: "Add at least one job (or internship, volunteer role or project work) so we can build your resume." };

  const store = await getStore();
  const existing = await store.findProfile(user.id);
  // The Master documents are written by the AI. For a first profile, say so before saving anything, instead of leaving a half-finished setup.
  if (!existing && !aiAvailable()) return { error: NO_AI };
  await store.saveProfile(user.id, toProfileSnapshot(existing?.id ?? `prof_${user.id}`, parsed.data, existing?.approvedFacts ?? []));

  await store.setCvImport(user.id, null); // the reviewed import is now part of the profile
  const firstTime = !existing;
  // Not "is this the first save" but "do the Master documents exist": if the AI failed last time, saving again tries again.
  // Every save of the profile also rewrites the Master Resume and Cover Letter from it (older versions stay in history).
  // An update is already saved by now; if the AI is not switched on, say that the documents were not refreshed.
  if (!aiAvailable()) return { error: `Your profile was saved. ${NO_AI}` };
  try {
    await generateMasterDocuments(store, user.id, String(fd.get("requestId") || crypto.randomUUID()));
  } catch (e) {
    if (e instanceof WorkflowOutputError) return { error: `Your profile was saved, but we couldn't update your Master documents. Save again to retry.${e.violations.length ? ` (Reason: ${e.violations.slice(0, 2).map((v) => v.slice(0, 180)).join(" · ")})` : ""}` };
    if (e instanceof AIProviderError) return { error: `Your profile was saved. ${describeAIError(e, "update your Master documents")} Save again to retry.` };
    throw e;
  }
  revalidatePath("/", "layout");
  if (firstTime) redirect(`/onboarding/done?notice=${notice("profile-created")}`);
  // Updating lands on the profile with a confirmation; the Master documents are read from the Documents tab.
  redirect(`/profile?notice=${notice("profile-updated-docs")}`);
}

const RETURN_TO = { onboarding: "/onboarding", edit: "/profile/edit" } as const;

/**
 * "Upload CV": read the file, extract the profile with the parser workflow (free, guarded so it can
 * only copy what the CV says), and keep it as a pending import. Nothing reaches the profile until the
 * user reviews the pre-filled form and clicks Save.
 */
export async function importCv(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await requireUser();
  if (await overLimit(await getStore(), RULES.aiUser, user.id)) return { error: "You're going fast. Please wait a few minutes before reading another CV." };
  const back = RETURN_TO[fd.get("returnTo") === "edit" ? "edit" : "onboarding"];
  // Either an uploaded file or pasted text; pasted text goes through the same reader as a .txt file.
  const pasted = String(fd.get("cvText") ?? "").trim();
  if (fd.has("cvText") && pasted.length < 100) return { error: "Paste your whole CV (at least a few lines) so we have enough to read." };
  const file = pasted ? new File([pasted], "Pasted CV.txt", { type: "text/plain" }) : fd.get("cv");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose your CV file first (PDF or Word)." };
  const store = await getStore();
  try {
    const text = await extractText(file);
    const { output } = await runWorkflow(
      resumeParser,
      { text },
      { userId: user.id, requestId: String(fd.get("requestId") || crypto.randomUUID()), credits: store.credits, runs: store.aiRuns },
    );
    if (!output.experiences.length && !output.education.length && !output.skills.length) {
      return { error: "We couldn't find jobs, education or skills in that file. Check it's your CV, or fill in the form below." };
    }
    await store.setCvImport(user.id, { fileName: file.name, draft: output, createdAt: new Date() });
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    if (e instanceof WorkflowOutputError) return { error: "We couldn't read your CV reliably. Please fill in the form below instead." };
    if (e instanceof AIProviderError) return { error: `${describeAIError(e, "read your CV")} You can also fill in the form by hand.` };
    throw e;
  }
  redirect(`${back}?imported=1`);
}

/** "Delete my profile", after the user confirms in the window. They land back in first-time setup. */
export async function deleteMyProfile() {
  const user = await requireUser();
  await (await getStore()).deleteProfile(user.id);
  revalidatePath("/", "layout");
  redirect(`/onboarding?notice=${notice("profile-deleted")}`);
}

export async function discardCvImport(fd: FormData) {
  const user = await requireUser();
  await (await getStore()).setCvImport(user.id, null);
  redirect(RETURN_TO[fd.get("returnTo") === "edit" ? "edit" : "onboarding"]);
}
