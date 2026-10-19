import { DEFAULT_CREDIT_ACTIONS } from "@/server/billing/catalog";
import { InsufficientCreditsError, type CreditActionPrice, type CreditStore, type LedgerEntry, type NewLedgerEntry } from "./types";

/**
 * In-memory CreditStore for tests and the no-database mode.
 * Node runs this synchronously between awaits, so append() is atomic within one process.
 */
export class MemoryCreditStore implements CreditStore {
  private entries: LedgerEntry[] = [];
  private balances = new Map<string, number>();
  private actions = new Map<string, CreditActionPrice>();
  private seq = 0;

  constructor(actions: CreditActionPrice[] = DEFAULT_CREDIT_ACTIONS.map((a) => ({ ...a, active: true }))) {
    actions.forEach((a) => this.actions.set(a.key, a));
  }

  setPrice(key: string, credits: number) {
    const a = this.actions.get(key);
    if (a) this.actions.set(key, { ...a, credits });
  }

  async getAction(key: string) {
    return this.actions.get(key) ?? null;
  }

  async listActions() {
    return [...this.actions.values()];
  }

  async getBalance(userId: string) {
    return this.balances.get(userId) ?? 0;
  }

  async append(e: NewLedgerEntry): Promise<LedgerEntry> {
    const dup = this.entries.find((x) => x.idempotencyKey === e.idempotencyKey);
    if (dup) return dup;
    const current = this.balances.get(e.userId) ?? 0;
    const next = current + e.delta;
    if (e.delta < 0 && next < 0) throw new InsufficientCreditsError(-e.delta, current);
    const entry: LedgerEntry = {
      id: `led_${++this.seq}`,
      documentId: null,
      aiRunId: null,
      refundOfId: null,
      note: null,
      ...e,
      balanceAfter: next,
      createdAt: new Date(),
    };
    this.entries.push(entry);
    this.balances.set(e.userId, next);
    return entry;
  }

  async findByIdempotencyKey(key: string) {
    return this.entries.find((x) => x.idempotencyKey === key) ?? null;
  }

  async link(entryId: string, link: { aiRunId?: string; documentId?: string }) {
    const e = this.entries.find((x) => x.id === entryId);
    if (e) Object.assign(e, { aiRunId: link.aiRunId ?? e.aiRunId, documentId: link.documentId ?? e.documentId });
  }

  async deleteForUser(userId: string) {
    this.entries = this.entries.filter((e) => e.userId !== userId);
    this.balances.delete(userId);
  }

  async history(userId: string, limit: number) {
    return this.entries.filter((e) => e.userId === userId).slice(-limit).reverse();
  }
}
