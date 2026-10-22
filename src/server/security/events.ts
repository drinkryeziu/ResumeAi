import "server-only";
import type { SecurityEventType } from "@/server/admin/overview";
import type { AppStore } from "@/server/store/types";

/**
 * Notes a security event for the admin dashboard. It holds the kind of event and, for a turned-away request, which limit was hit:
 * never an address, an email or a name. Fails quietly: noting an event must never break the request it describes.
 */
export async function recordSecurityEvent(store: AppStore, type: SecurityEventType, rule?: string, at = new Date()): Promise<void> {
  try {
    await store.recordSecurityEvent({ type, ...(rule ? { rule } : {}), at });
  } catch (e) {
    console.error("[security] could not note an event:", (e as Error).message);
  }
}
