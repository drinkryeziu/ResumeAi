import { createHash, randomBytes } from "node:crypto";
import type { Email } from "@/server/email/send";
import type { AppStore } from "@/server/store/types";
import { hashPassword } from "./password";

export const RESET_LINK_MINUTES = 60;
const TTL_MS = RESET_LINK_MINUTES * 60_000;
/** Asking again within this time sends nothing new, so the form can't be used to flood someone's inbox. */
const THROTTLE_MS = 60_000;

/** Only this hash is stored; the token itself exists in the email and nowhere else. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Starts a password reset. The caller answers the same way whether or not the email has an account, so the form
 * can't be used to find out who is registered. Sending problems are logged, never shown.
 */
export async function requestPasswordReset(store: AppStore, email: string, baseUrl: string, send: (e: Email) => Promise<unknown>, now = new Date()): Promise<void> {
  const user = await store.findUserByEmail(email);
  if (!user) return;
  const last = await store.lastPasswordResetAt(user.id);
  if (last && +now - +last < THROTTLE_MS) return;

  const token = randomBytes(32).toString("base64url");
  await store.createPasswordReset(user.id, hashToken(token), now, new Date(+now + TTL_MS));
  const link = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${token}`;
  try {
    await send({
      to: user.email,
      subject: "Reset your KRZResumeBuilder password",
      text: `Hi ${user.name.split(" ")[0] || "there"},\n\nUse this link to choose a new password. It works once and expires in ${RESET_LINK_MINUTES} minutes:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email. Your password stays as it is.\n\nKRZResumeBuilder`,
    });
  } catch (e) {
    console.error("[password-reset] could not send the email:", (e as Error).message);
  }
}

/** Is this link still good? (Used to decide which page to show; it does not use the link up.) */
export async function isResetTokenValid(store: AppStore, token: string, now = new Date()): Promise<boolean> {
  if (!token) return false;
  return (await store.findPasswordReset(hashToken(token), now)) !== null;
}

/** Uses the link up and sets the new password. False when the link is unknown, expired or already used. */
export async function completePasswordReset(store: AppStore, token: string, newPassword: string, now = new Date()): Promise<boolean> {
  if (!token) return false;
  const hit = await store.consumePasswordReset(hashToken(token), now);
  if (!hit) return false;
  return store.setPasswordHash(hit.userId, await hashPassword(newPassword));
}
