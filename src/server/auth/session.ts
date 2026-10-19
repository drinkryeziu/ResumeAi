import "server-only";
import { redirect } from "next/navigation";
import { getStore } from "@/server/store";
import { auth } from "./config";

/**
 * The single place auth is enforced: every page, action and API route calls this first.
 * Not signed in → sign-in page.
 */
export async function requireUser(): Promise<{ id: string; firstName: string; email: string }> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/sign-in");
  const store = await getStore();
  const user = await store.getUser(id);
  if (!user) redirect("/sign-in"); // e.g. the in-memory store restarted
  const profile = await store.findProfile(id);
  return { id, email: user.email, firstName: profile?.firstName || user.name.split(" ")[0] || "there" };
}

/**
 * For public pages (landing, sign-in, sign-up): the signed-in person's id, but only if that account still exists.
 * A login cookie can outlive its account (deleted on another device, or the server's data was reset); trusting it
 * would bounce between "/dashboard" and "/sign-in" forever.
 */
export async function signedInUserId(): Promise<string | null> {
  const id = (await auth())?.user?.id;
  if (!id) return null;
  return (await (await getStore()).getUser(id)) ? id : null;
}

/** First-time users must create their professional profile before anything else. */
export async function requireProfile() {
  const user = await requireUser();
  const profile = await (await getStore()).findProfile(user.id);
  if (!profile) redirect("/onboarding");
  return { user, profile };
}

/** For API routes: returns null instead of redirecting. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
