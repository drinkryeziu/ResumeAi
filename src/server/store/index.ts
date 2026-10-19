import "server-only";
import { connectMongo } from "@/server/db/mongo";
import { usesMongo } from "./config";
import { MemoryAppStore } from "./memory";
import { MongoAppStore } from "./mongo";
import type { AppStore } from "./types";

/**
 * One store per server process (kept on globalThis so Next.js hot reloads and warm serverless instances reuse it).
 *  - MONGODB_URI set  → MongoDB (Atlas). Data persists.
 *  - otherwise        → in-memory store, empty at start. Data resets when the server restarts.
 */
const g = globalThis as unknown as { __resumeaiStore?: Promise<AppStore> };

async function openMongoStore(): Promise<AppStore> {
  const { client, db } = await connectMongo();
  const store = new MongoAppStore(client, db);
  await store.ensureIndexes();
  return store;
}

async function openMemoryStore(): Promise<AppStore> {
  if (process.env.DATABASE_URL) console.warn("[store] DATABASE_URL is set but there is no Postgres store yet; set MONGODB_URI to persist data. Using the in-memory store.");
  return new MemoryAppStore();
}

/**
 * On Vercel the in-memory store is a trap: every serverless instance has its own empty copy, so accounts and documents
 * vanish. Refuse to start without MONGODB_URI there. (ALLOW_MEMORY_STORE=true overrides, for previews.)
 */
function assertStoreConfigured() {
  if (process.env.VERCEL && !usesMongo() && process.env.ALLOW_MEMORY_STORE !== "true") {
    throw new Error("MONGODB_URI is not set. Add it in Vercel: Project Settings > Environment Variables (see the README, section Deploy).");
  }
}

export function getStore(): Promise<AppStore> {
  assertStoreConfigured();
  if (!g.__resumeaiStore) {
    g.__resumeaiStore = (usesMongo() ? openMongoStore() : openMemoryStore()).catch((err) => {
      g.__resumeaiStore = undefined; // don't cache a failed start: the next request tries again
      throw err;
    });
  }
  return g.__resumeaiStore;
}

export type { AppStore } from "./types";
