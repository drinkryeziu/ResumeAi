import "server-only";
import { DEMO_USER_ID } from "@/server/demo/fixtures";
import { generateMasterDocuments } from "@/server/services/job-pipeline";
import { MemoryAppStore } from "./memory";
import type { AppStore } from "./types";

/**
 * One store per server process. Demo mode (no DATABASE_URL) uses the in-memory store, kept on
 * globalThis so it survives Next.js hot reloads. Phase 2 adds PrismaAppStore behind the same interface.
 */
const g = globalThis as unknown as { __applyaiStore?: Promise<AppStore> };

export function getStore(): Promise<AppStore> {
  if (!g.__applyaiStore) {
    g.__applyaiStore = (async () => {
      if (process.env.DATABASE_URL) {
        // Phase 2: return new PrismaAppStore(prisma)
        console.warn("[store] DATABASE_URL is set but PrismaAppStore lands in phase 2 — using the demo store.");
      }
      const store = new MemoryAppStore();
      await store.seedDemo();
      await generateMasterDocuments(store, DEMO_USER_ID, "demo-seed");
      return store;
    })();
  }
  return g.__applyaiStore;
}

export type { AppStore } from "./types";
