import { PROMOTIONS, type Promotion } from "@/server/billing/promotions";
import type { CreditService } from "./service";

/** Users already handled by this server instance, so a busy person doesn't cost a ledger lookup on every page. */
const handled = new Set<string>();

export const promotionKey = (promo: Pick<Promotion, "id">, userId: string) => `promo:${promo.id}:${userId}`;

/**
 * Gives the user every active promotion they haven't received yet. Safe to call as often as you like, from several
 * requests at once: the ledger ignores a second grant with the same key. `email` is the signed-in person's address, for
 * promotions that are a gift to named accounts.
 */
export async function grantPromotions(credits: CreditService, userId: string, promotions: readonly Promotion[] = PROMOTIONS, email?: string): Promise<number> {
  let granted = 0;
  for (const promo of promotions) {
    if (!promo.active || promo.credits <= 0) continue;
    // A gift to named accounts goes to nobody else.
    if (promo.emails && !(email && promo.emails.some((e) => e.toLowerCase() === email.trim().toLowerCase()))) continue;
    const key = promotionKey(promo, userId);
    if (handled.has(key)) continue;
    const before = await credits.balance(userId);
    const entry = await credits.grant(userId, promo.credits, "GRANT", key, promo.label);
    handled.add(key);
    if (entry.balanceAfter > before) granted += promo.credits; // false when the ledger already had this grant
  }
  return granted;
}

/** For tests: forget which users were handled. */
export const resetPromotionMemory = () => handled.clear();
