import { DEFAULT_PLANS } from "@/server/billing/catalog";
import type { AppStore } from "@/server/store/types";

/**
 * Creates the app user and grants the Free plan's starting credits (idempotent per user).
 * Phase 5 reads the grant from the Plan table instead of the seed catalog.
 */
export async function onboardUser(store: AppStore, u: { email: string; name: string; passwordHash: string | null }) {
  const user = await store.createUser(u);
  const free = DEFAULT_PLANS.find((p) => p.key === "FREE");
  if (free?.signupCredits) await store.credits.grant(user.id, free.signupCredits, "GRANT", `signup:${user.id}`, "Welcome credits");
  return user;
}
