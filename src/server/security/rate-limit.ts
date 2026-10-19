import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getStore } from "@/server/store";
import type { AppStore } from "@/server/store/types";

/** How many tries each kind of request gets in a time window. Fixed windows: simple, cheap, and good enough to stop floods and guessing. */
export const RULES = {
  /** Password guesses from one address, and against one account. */
  signInIp: { name: "signin-ip", limit: 20, windowMs: 15 * 60_000 },
  signInEmail: { name: "signin-email", limit: 8, windowMs: 15 * 60_000 },
  /** New accounts each get free credits, so sign-ups from one address are limited. */
  signUpIp: { name: "signup-ip", limit: 5, windowMs: 60 * 60_000 },
  resetRequestIp: { name: "reset-ip", limit: 8, windowMs: 60 * 60_000 },
  resetCompleteIp: { name: "reset-done-ip", limit: 15, windowMs: 60 * 60_000 },
  /** A full data export reads everything; a few a day is plenty. */
  exportUser: { name: "export-user", limit: 6, windowMs: 60 * 60_000 },
  /** Someone typing the email wrong again and again on the delete form. */
  deleteUser: { name: "delete-user", limit: 8, windowMs: 60 * 60_000 },
  /** AI actions cost real money; credits already limit them, this stops a runaway loop. */
  aiUser: { name: "ai-user", limit: 40, windowMs: 10 * 60_000 },
} as const;

export type Rule = (typeof RULES)[keyof typeof RULES];

/** Addresses, emails and ids are hashed, so the counters never hold anything readable. */
export const subjectOf = (value: string) => createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 24);

/** Counts this attempt and says whether it is over the limit. Fails open: a counter problem must never lock people out. */
export async function overLimit(store: AppStore, rule: Rule, subject: string, now = new Date()): Promise<boolean> {
  try {
    return (await store.hitRateLimit(`${rule.name}:${subjectOf(subject)}`, rule.windowMs, now)) > rule.limit;
  } catch (e) {
    console.error("[rate-limit] could not count:", (e as Error).message);
    return false;
  }
}

/** The caller's address as the host reports it (first entry of x-forwarded-for on Vercel). */
export function ipFrom(h: Pick<Headers, "get">): string {
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim() || "unknown";
}
export async function clientIp(): Promise<string> {
  return ipFrom(await headers());
}

/** For server actions: true when this request is over the limit for the caller's address. */
export async function ipOverLimit(rule: Rule): Promise<boolean> {
  return overLimit(await getStore(), rule, await clientIp());
}

export const TOO_MANY = "Too many tries. Please wait a few minutes and try again.";
