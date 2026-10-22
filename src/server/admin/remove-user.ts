import type { AppStore } from "@/server/store/types";

export type RemoveResult = "removed" | "not_found" | "protected" | "mismatch";

/**
 * The owner removes someone's account from the admin dashboard: the same full deletion as "Delete my account" in Settings
 * (profile, Master documents, applications, credit history, AI log, dashboard access). The owner must type the person's email,
 * and the owner's own account can never be removed this way.
 */
export async function removeUserAsOwner(store: AppStore, opts: { ownerId: string; ownerEmail: string; targetId: string; typedEmail: string }): Promise<RemoveResult> {
  const target = await store.getUser(opts.targetId);
  if (!target) return "not_found";
  if (target.id === opts.ownerId || target.email === opts.ownerEmail.trim().toLowerCase()) return "protected";
  if (opts.typedEmail.trim().toLowerCase() !== target.email) return "mismatch";
  await store.deleteAccount(target.id);
  return "removed";
}
