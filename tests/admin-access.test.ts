import { afterEach, describe, expect, it, vi } from "vitest";

import { adminRoleOf, DEFAULT_OWNER_EMAIL, ownerEmail } from "@/server/admin/access";
import { MemoryAppStore } from "@/server/store/memory";

afterEach(() => vi.unstubAllEnvs());

describe("who may open the admin dashboard", () => {
  it("makes the owner the account with the owner email, whatever its capitals", async () => {
    const store = new MemoryAppStore();
    expect(ownerEmail()).toBe(DEFAULT_OWNER_EMAIL);
    expect(await adminRoleOf(store, { id: "u1", email: ` ${DEFAULT_OWNER_EMAIL.toUpperCase()} ` })).toBe("owner");
  });

  it("lets ADMIN_OWNER_EMAIL replace the default owner", async () => {
    vi.stubEnv("ADMIN_OWNER_EMAIL", "Boss@Example.com");
    const store = new MemoryAppStore();
    expect(await adminRoleOf(store, { id: "u1", email: "boss@example.com" })).toBe("owner");
    expect(await adminRoleOf(store, { id: "u2", email: DEFAULT_OWNER_EMAIL })).toBeNull();
  });

  it("gives viewers the dashboard only after the owner added them, and nobody else anything", async () => {
    const store = new MemoryAppStore();
    const viewer = await store.createUser({ email: "viewer@example.com", name: "Vi", passwordHash: null });
    const other = await store.createUser({ email: "other@example.com", name: "Ot", passwordHash: null });
    expect(await adminRoleOf(store, viewer)).toBeNull();
    await store.addAdminUser(viewer.id, "owner");
    expect(await adminRoleOf(store, viewer)).toBe("viewer");
    expect(await adminRoleOf(store, other)).toBeNull();
  });
});
