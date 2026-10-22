import type { ClientSession, Collection, Db, MongoClient } from "mongodb";
import { DEFAULT_CREDIT_ACTIONS } from "@/server/billing/catalog";
import { InsufficientCreditsError, type CreditActionPrice, type CreditStore, type LedgerEntry, type NewLedgerEntry } from "./types";

type LedgerDoc = Omit<LedgerEntry, "id"> & { _id: string; ts: number };
type BalanceDoc = { _id: string; balance: number };
type ActionDoc = CreditActionPrice & { _id: string };

const isDuplicate = (e: unknown) => (e as { code?: number })?.code === 11000;
let seq = 0;
const newId = () => `led_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
/** Sortable and unique-enough within a process: entries written in the same millisecond keep their order. */
const tick = () => Date.now() * 1000 + (seq++ % 1000);

const toEntry = ({ _id, ts: _ts, ...rest }: LedgerDoc): LedgerEntry => ({ id: _id, ...rest });

/**
 * MongoDB CreditStore. append() MUST be atomic (see CreditStore): the balance change and the ledger entry are
 * written in one transaction, so a crash can never leave one without the other, and two requests can never
 * both spend the same credits. A spend only applies where balance >= amount, so a negative balance is impossible.
 * A unique index on idempotencyKey makes retries return the original entry.
 * Transactions need a replica set. MongoDB Atlas always is one; a plain single `mongod` is refused with a clear message.
 */
export class MongoCreditStore implements CreditStore {
  private ledger: Collection<LedgerDoc>;
  private balances: Collection<BalanceDoc>;
  private actions: Collection<ActionDoc>;
  private transactions?: Promise<boolean>;

  constructor(
    private readonly client: MongoClient,
    db: Db,
  ) {
    this.ledger = db.collection<LedgerDoc>("credit_ledger");
    this.balances = db.collection<BalanceDoc>("credit_balances");
    this.actions = db.collection<ActionDoc>("credit_actions");
  }

  async ensureIndexes() {
    await this.ledger.createIndex({ idempotencyKey: 1 }, { unique: true });
    await this.ledger.createIndex({ userId: 1, ts: -1 });
    // Seed prices once. $setOnInsert keeps any price changed later in the database.
    await this.actions.bulkWrite(
      DEFAULT_CREDIT_ACTIONS.map((a) => ({
        updateOne: { filter: { _id: a.key }, update: { $setOnInsert: { key: a.key, label: a.label, credits: a.credits, active: true } }, upsert: true },
      })),
    );
  }

  private requireTransactions() {
    this.transactions ??= this.client
      .db("admin")
      .command({ hello: 1 })
      .then((r) => {
        if (!r.setName && r.msg !== "isdbgrid") {
          throw new Error("MongoDB transactions are required for the credit ledger. Use MongoDB Atlas (always a replica set) or start mongod with --replSet.");
        }
        return true;
      });
    return this.transactions;
  }

  async getAction(key: string) {
    const a = await this.actions.findOne({ _id: key });
    return a ? { key: a.key, label: a.label, credits: a.credits, active: a.active } : null;
  }

  async listActions() {
    const rows = await this.actions.find({}).sort({ credits: -1 }).toArray();
    return rows.map((a) => ({ key: a.key, label: a.label, credits: a.credits, active: a.active }));
  }

  async getBalance(userId: string) {
    return (await this.balances.findOne({ _id: userId }))?.balance ?? 0;
  }

  async findByIdempotencyKey(key: string) {
    const d = await this.ledger.findOne({ idempotencyKey: key });
    return d ? toEntry(d) : null;
  }

  /** Applies the balance change. Spends only match where enough credit exists, so they can't overdraw. */
  private async applyDelta(userId: string, delta: number, session?: ClientSession) {
    if (delta < 0) {
      const res = await this.balances.findOneAndUpdate({ _id: userId, balance: { $gte: -delta } }, { $inc: { balance: delta } }, { returnDocument: "after", session });
      if (!res) throw new InsufficientCreditsError(-delta, (await this.balances.findOne({ _id: userId }, { session }))?.balance ?? 0);
      return res.balance;
    }
    const res = await this.balances.findOneAndUpdate({ _id: userId }, { $inc: { balance: delta } }, { upsert: true, returnDocument: "after", session });
    return res!.balance;
  }

  async append(e: NewLedgerEntry): Promise<LedgerEntry> {
    const existing = await this.findByIdempotencyKey(e.idempotencyKey);
    if (existing) return existing;

    const build = (balanceAfter: number): LedgerDoc => ({
      _id: newId(),
      documentId: null,
      aiRunId: null,
      refundOfId: null,
      note: null,
      ...e,
      balanceAfter,
      createdAt: new Date(),
      ts: tick(),
    });

    await this.requireTransactions();
    // Two requests can race to create the same user's balance row or reuse the same key; the loser retries
    // and then finds the winner's entry (or simply succeeds).
    for (let attempt = 0; ; attempt++) {
      const session = this.client.startSession();
      try {
        let doc!: LedgerDoc;
        await session.withTransaction(async () => {
          doc = build(await this.applyDelta(e.userId, e.delta, session));
          await this.ledger.insertOne(doc, { session });
        });
        return toEntry(doc);
      } catch (err) {
        if (!isDuplicate(err)) throw err;
        const won = await this.findByIdempotencyKey(e.idempotencyKey);
        if (won) return won;
        if (attempt >= 2) throw err;
      } finally {
        await session.endSession();
      }
    }
  }

  async link(entryId: string, link: { aiRunId?: string; documentId?: string }) {
    const set: Partial<LedgerDoc> = {};
    if (link.aiRunId) set.aiRunId = link.aiRunId;
    if (link.documentId) set.documentId = link.documentId;
    if (Object.keys(set).length) await this.ledger.updateOne({ _id: entryId }, { $set: set });
  }

  async deleteForUser(userId: string) {
    await this.ledger.deleteMany({ userId });
    await this.balances.deleteOne({ _id: userId });
  }

  /** Credits used and credits refunded since `since`, over everyone (for the owner's money report). */
  async totalsSince(since: Date) {
    const rows = await this.ledger
      .aggregate<{ _id: string; total: number }>([{ $match: { createdAt: { $gte: since }, reason: { $in: ["CONSUME", "REFUND"] } } }, { $group: { _id: "$reason", total: { $sum: "$delta" } } }])
      .toArray();
    const sum = (reason: string) => rows.find((r) => r._id === reason)?.total ?? 0;
    return { consumed: -sum("CONSUME"), refunded: sum("REFUND") };
  }

  async history(userId: string, limit: number) {
    return (await this.ledger.find({ userId }).sort({ ts: -1 }).limit(limit).toArray()).map(toEntry);
  }
}
