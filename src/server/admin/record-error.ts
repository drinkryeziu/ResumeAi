import { cleanMessage, cleanPath, type ErrorInput } from "./errors";
import type { AppStore } from "@/server/store/types";

/**
 * Notes an error people ran into, for the admin dashboard's error log. The message is cleaned first. It never throws: logging a
 * problem must not cause another one.
 */
export async function recordError(store: Pick<AppStore, "recordError">, e: { source: string; code: string; message: string; userId?: string | null; path?: string; at?: Date }): Promise<void> {
  try {
    const entry: ErrorInput = { source: e.source.slice(0, 60), code: e.code.slice(0, 60), message: cleanMessage(e.message), userId: e.userId ?? null, at: e.at ?? new Date(), ...(e.path ? { path: cleanPath(e.path) } : {}) };
    await store.recordError(entry);
  } catch (err) {
    console.error("[errors] could not log an error:", (err as Error).message);
  }
}
