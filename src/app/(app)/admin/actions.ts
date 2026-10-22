"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { ownerEmail } from "@/server/admin/access";
import { removeUserAsOwner } from "@/server/admin/remove-user";
import { requireOwner } from "@/server/auth/admin";
import { recordSecurityEvent } from "@/server/security/events";
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

/** The owner removes a person's account, after typing that person's email. Nothing of theirs is kept. */
export async function removeUser(_: AdminState, fd: FormData): Promise<AdminState> {
  const { user, store } = await requireOwner();
  if (await overLimit(store, RULES.adminUser, user.id)) return { error: TOO_MANY };
  const parsed = z.object({ userId: z.string().min(1).max(80), email: z.string().max(320) }).safeParse({ userId: fd.get("userId"), email: fd.get("email") });
  if (!parsed.success) return { error: "Something was missing. Nothing was deleted." };
  const result = await removeUserAsOwner(store, { ownerId: user.id, ownerEmail: ownerEmail(), targetId: parsed.data.userId, typedEmail: parsed.data.email });
  if (result === "mismatch") return { error: "That isn't this account's email address. Nothing was deleted." };
  if (result === "protected") return { error: "The owner's account can't be removed here." };
  if (result === "not_found") {
    revalidatePath("/admin");
    return { ok: "That account was already gone." };
  }
  await recordSecurityEvent(store, "account_removed");
  revalidatePath("/admin");
  return { ok: "The account and everything in it was deleted." };
}

/** The owner marks one problem in the error log as fixed: its entries are removed. */
export async function clearErrorGroup(fd: FormData) {
  const { user, store } = await requireOwner();
  if (await overLimit(store, RULES.adminUser, user.id)) return;
  const parsed = z.object({ source: z.string().min(1).max(60), code: z.string().min(1).max(60) }).safeParse({ source: fd.get("source"), code: fd.get("code") });
  if (parsed.success) await store.clearErrors(parsed.data.source, parsed.data.code);
  revalidatePath("/admin");
}

/** The owner adds a fixed monthly cost of running the app (hosting, database, email…). */
export async function addRunningCost(_: AdminState, fd: FormData): Promise<AdminState> {
  const { user, store } = await requireOwner();
  if (await overLimit(store, RULES.adminUser, user.id)) return { error: TOO_MANY };
  const parsed = z
    .object({ label: z.string().trim().min(1, "Say what the cost is for, like Hosting.").max(60, "Keep the name under 60 characters."), amount: z.coerce.number("Enter the monthly amount in dollars.").min(0.01, "Enter an amount above zero.").max(100_000, "That is more than we expect. Check the amount.") })
    .safeParse({ label: fd.get("label"), amount: fd.get("amount") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if ((await store.listRunningCosts()).length >= 30) return { error: "That is plenty of items. Remove one before adding another." };
  await store.addRunningCost(parsed.data.label, Math.round(parsed.data.amount * 100));
  revalidatePath("/admin");
  return { ok: `${parsed.data.label} added.` };
}

export async function removeRunningCost(fd: FormData) {
  const { user, store } = await requireOwner();
  if (await overLimit(store, RULES.adminUser, user.id)) return;
  const id = z.string().min(1).max(80).safeParse(fd.get("id"));
  if (id.success) await store.removeRunningCost(id.data);
  revalidatePath("/admin");
}
