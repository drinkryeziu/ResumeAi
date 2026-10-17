import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The credit ledger needs transactions, which need a replica set (Atlas always is one). On a plain single
 * mongod the store must refuse with a clear message instead of quietly using a weaker path.
 * Skipped when no MongoDB server can be started, like store.mongo.test.ts.
 */
const { MongoClient } = await import("mongodb");
const { MongoAppStore } = await import("@/server/store/mongo");

let server: { getUri(): string; stop(): Promise<unknown> } | undefined;
try {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  server = await MongoMemoryServer.create();
} catch (err) {
  if (process.env.MONGODB_TEST_REQUIRED) throw err;
  console.warn(`[store.mongo-standalone.test] No MongoDB available, skipping: ${(err as Error).message}`);
}

if (!server) {
  describe.skip("MongoDB without a replica set (no server available)", () => {});
} else {
  const client = new MongoClient(server.getUri());
  await client.connect();
  afterAll(async () => {
    await client.close();
    await server?.stop();
  });
  describe("MongoDB without a replica set", () => {
    it("refuses credit changes with a message that says what to do", async () => {
      const db = client.db("resumeai_test_standalone");
      const store = new MongoAppStore(client, db);
      await store.ensureIndexes();
      await expect(store.credits.grant("u1", 10, "GRANT", "k1")).rejects.toThrow(/replica set/i);
      expect(await store.credits.balance("u1")).toBe(0); // nothing was written
      await db.dropDatabase();
    });
  });
}
