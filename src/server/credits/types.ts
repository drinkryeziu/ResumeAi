export type LedgerReason = "GRANT" | "PURCHASE" | "CONSUME" | "REFUND" | "EXPIRE" | "ADJUST";

export interface LedgerEntry {
  id: string;
  userId: string;
  delta: number;
  balanceAfter: number;
  reason: LedgerReason;
  actionKey: string | null;
  jobId: string | null;
  documentId: string | null;
  aiRunId: string | null;
  refundOfId: string | null;
  note: string | null;
  idempotencyKey: string;
  createdAt: Date;
}

export type NewLedgerEntry = Omit<LedgerEntry, "id" | "balanceAfter" | "createdAt" | "documentId" | "aiRunId" | "refundOfId" | "note"> &
  Partial<Pick<LedgerEntry, "documentId" | "aiRunId" | "refundOfId" | "note">>;

export interface CreditActionPrice {
  key: string;
  label: string;
  credits: number;
  active: boolean;
}

/**
 * Persistence contract. `append` MUST be atomic: check the balance would not go negative
 * (for negative deltas), honour the idempotency key, write the entry and the cached balance together.
 */
export interface CreditStore {
  getAction(key: string): Promise<CreditActionPrice | null>;
  listActions(): Promise<CreditActionPrice[]>;
  getBalance(userId: string): Promise<number>;
  append(entry: NewLedgerEntry): Promise<LedgerEntry>;
  findByIdempotencyKey(key: string): Promise<LedgerEntry | null>;
  link(entryId: string, link: { aiRunId?: string; documentId?: string }): Promise<void>;
  history(userId: string, limit: number): Promise<LedgerEntry[]>;
  /** Account deletion: removes this user's balance and every ledger entry. (The ledger is append-only for everything else.) */
  deleteForUser(userId: string): Promise<void>;
}

export class InsufficientCreditsError extends Error {
  constructor(
    readonly required: number,
    readonly available: number,
  ) {
    super(`This needs ${required} credits; you have ${available}.`);
    this.name = "InsufficientCreditsError";
  }
}

export class UnknownActionError extends Error {
  constructor(readonly actionKey: string) {
    super(`Unknown or inactive credit action: ${actionKey}`);
    this.name = "UnknownActionError";
  }
}
