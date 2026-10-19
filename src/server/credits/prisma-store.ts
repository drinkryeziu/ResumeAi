import { Prisma, type PrismaClient } from "@prisma/client";
import { InsufficientCreditsError, type CreditStore, type LedgerEntry, type NewLedgerEntry } from "./types";

/**
 * Postgres CreditStore. append() runs in a SERIALIZABLE transaction: read the cached balance,
 * refuse to go negative, insert the ledger row and bump the balance with an optimistic version check.
 * A unique index on idempotencyKey makes retries safe.
 */
export class PrismaCreditStore implements CreditStore {
  constructor(private readonly db: PrismaClient) {}

  async getAction(key: string) {
    return this.db.creditAction.findUnique({ where: { key } });
  }

  async listActions() {
    return this.db.creditAction.findMany({ where: { active: true }, orderBy: { credits: "desc" } });
  }

  async deleteForUser(userId: string) {
    await this.db.$transaction([this.db.creditLedger.deleteMany({ where: { userId } }), this.db.creditBalance.deleteMany({ where: { userId } })]);
  }

  async getBalance(userId: string) {
    const row = await this.db.creditBalance.findUnique({ where: { userId } });
    return row?.balance ?? 0;
  }

  async append(e: NewLedgerEntry): Promise<LedgerEntry> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.$transaction(
          async (tx: Prisma.TransactionClient) => {
            const dup = await tx.creditLedger.findUnique({ where: { idempotencyKey: e.idempotencyKey } });
            if (dup) return dup as LedgerEntry;
            const bal = await tx.creditBalance.upsert({ where: { userId: e.userId }, create: { userId: e.userId, balance: 0 }, update: {} });
            const next = bal.balance + e.delta;
            if (e.delta < 0 && next < 0) throw new InsufficientCreditsError(-e.delta, bal.balance);
            const updated = await tx.creditBalance.updateMany({
              where: { userId: e.userId, version: bal.version },
              data: { balance: next, version: { increment: 1 } },
            });
            if (updated.count !== 1) throw new Prisma.PrismaClientKnownRequestError("Balance changed concurrently", { code: "P2034", clientVersion: "" });
            return (await tx.creditLedger.create({ data: { ...e, balanceAfter: next } })) as LedgerEntry;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (err) {
        // P2034 = write conflict / serialization failure → retry
        if (err instanceof Prisma.PrismaClientKnownRequestError && (err as { code?: string }).code === "P2034" && attempt < 2) continue;
        throw err;
      }
    }
    throw new Error("Could not write credit entry after retries");
  }

  async findByIdempotencyKey(key: string) {
    return (await this.db.creditLedger.findUnique({ where: { idempotencyKey: key } })) as LedgerEntry | null;
  }

  async link(entryId: string, link: { aiRunId?: string; documentId?: string }) {
    await this.db.creditLedger.update({ where: { id: entryId }, data: link });
  }

  async history(userId: string, limit: number) {
    return (await this.db.creditLedger.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit })) as LedgerEntry[];
  }
}
