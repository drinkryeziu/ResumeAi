"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { ownerEmail } from "@/server/admin/access";
import { requireOwner } from "@/server/auth/admin";
import { overLimit, RULES, TOO_MANY } from "@/server/security/rate-limit";

export type AdminState = { error?: string; ok?: string } | undefined;

/** The owner lets an existing account open the admin dashboard (read only). The person must have signed up first. */
export async function addViewer(_: AdminState, fd: FormData): Promise<AdminState> {
  const { user, store } = await requireOwner();
  if (await overLimit(store, RULES.adminUser, user.id)) return { error: TOO_MANY };
  const parsed = z.object({ email: z.email("Enter a valid email address.") }).safeParse({ email: String(fd.get("email") ?? "").trim() });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const target = await store.findUserByEmail(parsed.data.email);
  if (!target) return { error: "No account uses that email. Ask them to sign up first, then add them here." };
  if (target.email === ownerEmail()) return { error: "That is you. The owner always has access." };
  await store.addAdminUser(target.id, user.id);
  revalidatePath("/admin");
  return { ok: `${target.name} can now open the admin dashboard.` };
}

export async function removeViewer(fd: FormData) {
  const { user, store } = await requireOwner();
  if (await overLimit(store, RULES.adminUser, user.id)) return;
  const userId = z.string().min(1).max(80).safeParse(fd.get("userId"));
  if (userId.success) await store.removeAdminUser(userId.data);
  revalidatePath("/admin");
}
