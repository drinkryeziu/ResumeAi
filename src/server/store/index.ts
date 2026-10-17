import "server-only";
import { connectMongo } from "@/server/db/mongo";
import { DEMO_USER_ID } from "@/server/demo/fixtures";
import { generateMasterDocuments } from "@/server/services/job-pipeline";
import { demoAccountEnabled, usesMongo } from "./config";
import { MemoryAppStore } from "./memory";
import { MongoAppStore } from "./mongo";
import type { AppStore } from "./types";

/**
 * One store per server process (kept on globalThis so Next.js hot reloads and warm serverless instances reuse it).
 *  - MONGODB_URI set  → MongoDB (Atlas). Data persists. The demo account is created only if MONGODB_SEED_DEMO=true.
 *  - otherwise        → in-memory demo store, seeded with the demo account. Data resets when the server restarts.
 */
const g = globalThis as unknown as { __applyaiStore?: Promise<AppStore> };

async function openMongoStore(): Promise<AppStore> {
  const { client, db } = await connectMongo();
  const store = new MongoAppStore(client, db);
  await store.ensureIndexes();
  if (demoAccountEnabled()) {
    await store.seedDemo();
    if (!(await store.resumeForJob(DEMO_USER_ID, null))) await generateMasterDocuments(store, DEMO_USER_ID, "demo-seed");
  }
  return store;
}

async function openMemoryStore(): Promise<AppStore> {
  if (process.env.DATABASE_URL) console.warn("[store] DATABASE_URL is set but there is no Postgres store yet; set MONGODB_URI to persist data. Using the demo store.");
  const store = new MemoryAppStore();
  await store.seedDemo();
  await generateMasterDocuments(store, DEMO_USER_ID, "demo-seed");
  return store;
}

export function getStore(): Promise<AppStore> {
  if (!g.__applyaiStore) {
    g.__applyaiStore = (usesMongo() ? openMongoStore() : openMemoryStore()).catch((err) => {
      g.__applyaiStore = undefined; // don't cache a failed start: the next request tries again
      throw err;
    });
  }
  return g.__applyaiStore;
}

export type { AppStore } from "./types";
