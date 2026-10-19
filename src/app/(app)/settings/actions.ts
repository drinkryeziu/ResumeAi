"use server";

import { z } from "zod/v4";
import { signOut } from "@/server/auth/config";
import { requireUser } from "@/server/auth/session";
import { overLimit, RULES } from "@/server/security/rate-limit";
import { deleteAccount } from "@/server/services/account";
import { getStore } from "@/server/store";

export type SettingsState = { error?: string } | undefined;

/** "Delete my account": the typed email must match, then everything is removed and the person is signed out. */
export async function deleteMyAccount(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const store = await getStore();
  if (await overLimit(store, RULES.deleteUser, user.id)) return { error: "Too many tries. Please wait a while and try again." };
  const typed = z.string().max(320).safeParse(fd.get("email"));
  if (!typed.success || !(await deleteAccount(store, user.id, typed.data))) return { error: "That isn't the email address of this account. Nothing was deleted." };
  await signOut({ redirectTo: "/?account-deleted=1" });
}
