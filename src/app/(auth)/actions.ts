"use server";

import { AuthError } from "next-auth";
import { z } from "zod/v4";
import { onboardUser } from "@/server/auth/accounts";
import { signIn, signOut } from "@/server/auth/config";
import { hashPassword } from "@/server/auth/password";
import { getStore } from "@/server/store";

export type AuthState = { error?: string } | undefined;

export async function signInWithPassword(_: AuthState, fd: FormData): Promise<AuthState> {
  try {
    await signIn("credentials", { email: fd.get("email"), password: fd.get("password"), redirectTo: "/dashboard" });
  } catch (e) {
    if (e instanceof AuthError) return { error: "That email and password don't match an account." };
    throw e; // Next.js redirect
  }
}

const SignUp = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(200),
});

export async function signUpWithPassword(_: AuthState, fd: FormData): Promise<AuthState> {
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

export async function signInWithProvider(fd: FormData) {
  const provider = z.enum(["google", "linkedin"]).parse(fd.get("provider"));
  await signIn(provider, { redirectTo: "/dashboard" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
