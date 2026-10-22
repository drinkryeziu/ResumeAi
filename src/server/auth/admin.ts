import "server-only";
import { notFound } from "next/navigation";
import { adminRoleOf } from "@/server/admin/access";
import { getStore } from "@/server/store";
import { requireUser } from "./session";

/**
 * For admin pages: the signed-in person and their role, or the not-found page. Anyone else gets the same page as for an address
 * that does not exist, so the dashboard does not even show it is there.
 */
export async function requireAdmin() {
  const user = await requireUser();
  const store = await getStore();
  const role = await adminRoleOf(store, user);
  if (!role) notFound();
  return { user, role, store };
}

/** For the actions only the owner may take. */
export async function requireOwner() {
  const admin = await requireAdmin();
  if (admin.role !== "owner") notFound();
  return admin;
}
