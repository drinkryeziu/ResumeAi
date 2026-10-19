import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.AI_FORCE_MOCK = "true";

import { storeContract } from "./store-contract";

/**
 * Runs the same contract against a real MongoDB.
 *  - MONGODB_TEST_URI set: uses that server (a local replica set, or an Atlas cluster you don't mind writing to).
 *  - otherwise: starts a throwaway single-node replica set with mongodb-memory-server. The first run downloads an
 *    official MongoDB server binary (a few hundred MB, cached afterwards); no credentials or accounts involved.
 * Every test gets its own database named resumeai_test_<random> and drops it afterwards.
 * If no server can be started (for example offline on the first run) these tests are skipped with a warning;
 * set MONGODB_TEST_REQUIRED=1 (CI) to fail instead.
 */
const { MongoClient } = await import("mongodb");
const { MongoAppStore } = await import("@/server/store/mongo");

let uri = process.env.MONGODB_TEST_URI;
let stop = async () => {};
let reason = "";

if (!uri) {
  try {
    const { MongoMemoryReplSet } = await import("mongodb-memory-server");
    const rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    uri = rs.getUri();
    stop = async () => {
      await rs.stop();
    };
  } catch (err) {
    reason = (err as Error).message;
    if (process.env.MONGODB_TEST_REQUIRED) throw err;
    console.warn(`[store.mongo.test] No MongoDB available, skipping: ${reason}`);
  }
}

if (!uri) {
  describe.skip("AppStore contract: MongoDB (no server available)", () => {});
} else {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 20 });
  await client.connect();
  storeContract("MongoDB", async () => {
    const db = client.db(`resumeai_test_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`);
    const store = new MongoAppStore(client, db);
    await store.ensureIndexes();
    return {
      store,
      close: async () => {
        await db.dropDatabase();
      },
    };
  });
  // vitest runs this after the file's tests finish
  afterAll(async () => {
    await client.close();
    await stop();
  });
}
