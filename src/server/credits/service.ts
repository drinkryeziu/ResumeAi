import { InsufficientCreditsError, UnknownActionError, type CreditStore, type LedgerEntry } from "./types";

export interface Reservation {
  entry: LedgerEntry | null; // null for free actions — nothing to settle or refund
  credits: number;
  actionKey: string;
}

/**
 * Credits follow reserve → run → settle:
 *  - reserve() writes a CONSUME entry BEFORE the AI call, so concurrent requests can't overspend;
 *  - settle() links it to the AI run and the document produced;
 *  - refund() writes an equal REFUND entry if the run fails. Entries are never edited or deleted.
 */
export class CreditService {
  constructor(private readonly store: CreditStore) {}

  async priceOf(actionKey: string): Promise<number> {
    const action = await this.store.getAction(actionKey);
    if (!action || !action.active) throw new UnknownActionError(actionKey);
    return action.credits;
  }

  balance(userId: string) {
    return this.store.getBalance(userId);
  }

  async reserve(userId: string, actionKey: string, opts: { idempotencyKey: string; jobId?: string | null }): Promise<Reservation> {
    const credits = await this.priceOf(actionKey);
    if (credits === 0) return { entry: null, credits: 0, actionKey };

    const existing = await this.store.findByIdempotencyKey(opts.idempotencyKey);
    if (existing) return { entry: existing, credits: -existing.delta, actionKey };

    const available = await this.store.getBalance(userId);
    if (available < credits) throw new InsufficientCreditsError(credits, available);

    const entry = await this.store.append({
      userId,
      delta: -credits,
      reason: "CONSUME",
      actionKey,
      jobId: opts.jobId ?? null,
      idempotencyKey: opts.idempotencyKey,
    });
    return { entry, credits, actionKey };
  }

  async settle(r: Reservation, link: { aiRunId?: string; documentId?: string }) {
    if (r.entry) await this.store.link(r.entry.id, link);
  }

  async refund(r: Reservation, note: string) {
    if (!r.entry) return;
    const key = `refund:${r.entry.id}`;
    if (await this.store.findByIdempotencyKey(key)) return;
    await this.store.append({
      userId: r.entry.userId,
      delta: r.credits,
      reason: "REFUND",
      actionKey: r.actionKey,
      jobId: r.entry.jobId,
      refundOfId: r.entry.id,
      note,
      idempotencyKey: key,
    });
  }

  grant(userId: string, credits: number, reason: "GRANT" | "PURCHASE" | "ADJUST", idempotencyKey: string, note?: string) {
    return this.store.append({ userId, delta: credits, reason, actionKey: null, jobId: null, idempotencyKey, note: note ?? null });
  }

  history(userId: string, limit = 50) {
    return this.store.history(userId, limit);
  }

  listPrices() {
    return this.store.listActions();
  }
}
