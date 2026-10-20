import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { MemoryAppStore } = await import("@/server/store/memory");
const { grantPromotions, resetPromotionMemory } = await import("@/server/credits/promotions");
const { PROMOTIONS } = await import("@/server/billing/promotions");
const accounts = await import("@/server/auth/accounts");

const launch = { id: "launch-150", credits: 150, active: true, label: "Launch credits" };
const newUser = async (store: InstanceType<typeof MemoryAppStore>, email: string) => (await accounts.onboardUser(store, { email, name: "T", passwordHash: null })).id;

describe("launch credits", () => {
  beforeEach(() => resetPromotionMemory());

  it("is on, for 150 credits, in the shipped list", () => {
    expect(PROMOTIONS).toEqual([expect.objectContaining({ id: "launch-150", credits: 150, active: true })]);
  });

  it("gives a user 150 credits once, however many times it is asked", async () => {
    const store = new MemoryAppStore();
    const id = await newUser(store, "a@example.com");
    const start = await store.credits.balance(id); // the sign-up credits
    expect(await grantPromotions(store.credits, id, [launch])).toBe(150);
    expect(await store.credits.balance(id)).toBe(start + 150);
    resetPromotionMemory(); // even a fresh server instance doesn't give it twice
    await grantPromotions(store.credits, id, [launch]);
    await grantPromotions(store.credits, id, [launch]);
    expect(await store.credits.balance(id)).toBe(start + 150);
  });

  it("is safe when several page loads ask at the same moment", async () => {
    const store = new MemoryAppStore();
    const id = await newUser(store, "b@example.com");
    const start = await store.credits.balance(id);
    await Promise.all(Array.from({ length: 8 }, () => grantPromotions(store.credits, id, [launch])));
    expect(await store.credits.balance(id)).toBe(start + 150);
  });

  it("gives every user their own 150, old accounts and new ones alike", async () => {
    const store = new MemoryAppStore();
    const old = await newUser(store, "old@example.com");
    const oldStart = await store.credits.balance(old);
    await grantPromotions(store.credits, old, [launch]);
    const fresh = await newUser(store, "fresh@example.com");
    const freshStart = await store.credits.balance(fresh);
    await grantPromotions(store.credits, fresh, [launch]);
    expect(await store.credits.balance(old)).toBe(oldStart + 150);
    expect(await store.credits.balance(fresh)).toBe(freshStart + 150);
  });

  it("stops when the promotion is switched off, and keeps what was already given", async () => {
    const store = new MemoryAppStore();
    const early = await newUser(store, "early@example.com");
    const earlyStart = await store.credits.balance(early);
    await grantPromotions(store.credits, early, [launch]);
    const late = await newUser(store, "late@example.com");
    const lateStart = await store.credits.balance(late);
    const off = { ...launch, active: false };
    expect(await grantPromotions(store.credits, late, [off])).toBe(0);
    await grantPromotions(store.credits, early, [off]);
    expect(await store.credits.balance(late)).toBe(lateStart);
    expect(await store.credits.balance(early)).toBe(earlyStart + 150);
  });

  it("a second promotion with a new id is a second grant, and shows in the history under its label", async () => {
    const store = new MemoryAppStore();
    const id = await newUser(store, "c@example.com");
    const start = await store.credits.balance(id);
    await grantPromotions(store.credits, id, [launch]);
    await grantPromotions(store.credits, id, [launch, { id: "spring-50", credits: 50, active: true, label: "Spring credits" }]);
    expect(await store.credits.balance(id)).toBe(start + 200);
    const notes = (await store.credits.history(id, 10)).map((e) => e.note);
    expect(notes).toEqual(expect.arrayContaining(["Launch credits", "Spring credits"]));
  });

  it("ignores empty or zero promotions", async () => {
    const store = new MemoryAppStore();
    const id = await newUser(store, "d@example.com");
    const start = await store.credits.balance(id);
    expect(await grantPromotions(store.credits, id, [{ ...launch, credits: 0 }])).toBe(0);
    expect(await grantPromotions(store.credits, id, [])).toBe(0);
    expect(await store.credits.balance(id)).toBe(start);
  });
});
