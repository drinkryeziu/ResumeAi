import type { AppStore } from "@/server/store/types";

/**
 * Who may open the admin dashboard.
 *  - The owner: the account whose email is ADMIN_OWNER_EMAIL (default below). Only the owner adds or removes other people.
 *  - Viewers: existing accounts the owner has added. They can read the dashboard, nothing else.
 */
export const DEFAULT_OWNER_EMAIL = "drinkryeziu@gmail.com";
export const ownerEmail = () => (process.env.ADMIN_OWNER_EMAIL?.trim() || DEFAULT_OWNER_EMAIL).toLowerCase();

export type AdminRole = "owner" | "viewer";

export async function adminRoleOf(store: Pick<AppStore, "isAdminUser">, user: { id: string; email: string }): Promise<AdminRole | null> {
  if (user.email.trim().toLowerCase() === ownerEmail()) return "owner";
  return (await store.isAdminUser(user.id)) ? "viewer" : null;
}
