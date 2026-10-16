import { describe, expect, it } from "vitest";
import { MemoryCreditStore } from "@/server/credits/memory-store";
import { CreditService } from "@/server/credits/service";
import { InsufficientCreditsError } from "@/server/credits/types";

const setup = async (balance = 50) => {
  const store = new MemoryCreditStore();
  const credits = new CreditService(store);
  if (balance) await credits.grant("u1", balance, "GRANT", "seed");
  return { store, credits };
};

describe("CreditService", () => {
  it("reserves the configured price and writes a CONSUME entry", async () => {
    const { credits } = await setup();
    const r = await credits.reserve("u1", "OPTIMIZE_RESUME", { idempotencyKey: "req-1", jobId: "job1" });
    expect(r.credits).toBe(15);
    expect(await credits.balance("u1")).toBe(35);
    const [last] = await credits.history("u1");
    expect(last).toMatchObject({ reason: "CONSUME", delta: -15, balanceAfter: 35, actionKey: "OPTIMIZE_RESUME", jobId: "job1" });
  });

  it("reads prices from the store, so a price change needs no deploy", async () => {
    const { store, credits } = await setup();
    store.setPrice("ANALYZE_JOB", 2);
    await credits.reserve("u1", "ANALYZE_JOB", { idempotencyKey: "k" });
    expect(await credits.balance("u1")).toBe(48);
  });

  it("charges once for a repeated request id (double-click safe)", async () => {
    const { credits } = await setup();
    await credits.reserve("u1", "JOB_MATCH", { idempotencyKey: "same" });
    await credits.reserve("u1", "JOB_MATCH", { idempotencyKey: "same" });
    expect(await credits.balance("u1")).toBe(45);
  });

  it("refuses when the balance is too low and leaves it unchanged", async () => {
    const { credits } = await setup(10);
    await expect(credits.reserve("u1", "OPTIMIZE_RESUME", { idempotencyKey: "x" })).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(await credits.balance("u1")).toBe(10);
  });

  it("refunds exactly once", async () => {
    const { credits } = await setup();
    const r = await credits.reserve("u1", "GENERATE_COVER_LETTER", { idempotencyKey: "y" });
    await credits.refund(r, "failed");
    await credits.refund(r, "failed again");
    expect(await credits.balance("u1")).toBe(50);
    expect((await credits.history("u1")).filter((e) => e.reason === "REFUND")).toHaveLength(1);
  });

  it("free actions write no ledger entry", async () => {
    const { credits } = await setup();
    const r = await credits.reserve("u1", "PARSE_RESUME", { idempotencyKey: "z" });
    expect(r.entry).toBeNull();
    expect(await credits.history("u1")).toHaveLength(1); // only the seed grant
  });
});
