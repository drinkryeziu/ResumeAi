"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod/v4";
import { onboardUser } from "@/server/auth/accounts";
import { signIn, signOut } from "@/server/auth/config";
import { hashPassword } from "@/server/auth/password";
import { completePasswordReset, requestPasswordReset } from "@/server/auth/password-reset";
import { siteUrl } from "@/server/auth/site-url";
import { sendEmail } from "@/server/email/send";
import { getStore } from "@/server/store";

export type AuthState = { error?: string; sent?: string } | undefined;

/**
 * Production without AUTH_SECRET makes Auth.js answer with a raw JSON "server configuration" error. Say what is wrong
 * on the form instead, before anything is created. (Only the cheap checks here; /api/health does the database ping.)
 */
const notSetUp = (): AuthState => {
  if (!process.env.AUTH_SECRET?.trim())
    return {
      error: "This site isn't fully set up yet: AUTH_SECRET is missing. If you run it, add it in your hosting settings and redeploy. Open /api/health to see what else is missing.",
    };
  return undefined;
};

export async function signInWithPassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const missing = notSetUp();
  if (missing) return missing;
  try {
    await signIn("credentials", { email: fd.get("email"), password: fd.get("password"), redirectTo: "/dashboard" });
  } catch (e) {
    if (e instanceof AuthError) return { error: "That email and password don't match an account." };
    throw e; // Next.js redirect
  }
}

const SignUp = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(120),
    email: z.email("Enter a valid email address."),
    password: z.string().min(8, "Use at least 8 characters for your password.").max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "The two passwords don't match.", path: ["confirmPassword"] });

export async function signUpWithPassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const missing = notSetUp(); // before creating anything: a half-made account is worse than a clear message
  if (missing) return missing;
  const parsed = SignUp.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const store = await getStore();
  if (await store.findUserByEmail(parsed.data.email)) return { error: "An account with this email already exists. Sign in instead." };
  await onboardUser(store, { email: parsed.data.email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) });
  try {
    await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirectTo: "/onboarding" });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Your account was created, but we couldn't sign you in. Try signing in." };
    throw e;
  }
}

/** Same answer whether or not the email has an account, so the form can't be used to find out who is registered. */
export async function requestPasswordResetAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = z.object({ email: z.email("Enter a valid email address.") }).safeParse({ email: String(fd.get("email") ?? "").trim() });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await requestPasswordReset(await getStore(), parsed.data.email, await siteUrl(), sendEmail);
  return { sent: parsed.data.email };
}

const NewPassword = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8, "Use at least 8 characters for your password.").max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "The two passwords don't match.", path: ["confirmPassword"] });

export async function resetPasswordAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = NewPassword.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const ok = await completePasswordReset(await getStore(), parsed.data.token, parsed.data.password);
  if (!ok) return { error: "This link has expired or was already used. Ask for a new one." };
  redirect("/sign-in?reset=1");
}

export async function signInWithProvider(fd: FormData) {
  const provider = z.enum(["google", "linkedin"]).parse(fd.get("provider"));
  await signIn(provider, { redirectTo: "/dashboard" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
