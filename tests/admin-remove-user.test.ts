import { describe, expect, it } from "vitest";
import { removeUserAsOwner } from "@/server/admin/remove-user";
import { MemoryAppStore } from "@/server/store/memory";
import { TEST_JOB, TEST_PROFILE } from "./fixtures";

async function setup() {
  const store = new MemoryAppStore();
  const owner = await store.createUser({ email: "owner@example.com", name: "Owner", passwordHash: null });
  const target = await store.createUser({ email: "Target@Example.com", name: "Target", passwordHash: null });
  const other = await store.createUser({ email: "other@example.com", name: "Other", passwordHash: null });
  for (const u of [target, other]) {
    await store.saveProfile(u.id, { ...structuredClone(TEST_PROFILE), id: `prof_${u.id}`, approvedFacts: [] });
    await store.createJob(u.id, { title: TEST_JOB.title, company: TEST_JOB.company, description: TEST_JOB.description });
  }
  return { store, owner, target, other, args: (targetId: string, typedEmail: string) => ({ ownerId: owner.id, ownerEmail: "Owner@Example.com", targetId, typedEmail }) };
}

describe("the owner deleting an account", () => {
  it("deletes everything of that person, once their email is typed, and nothing of anyone else's", async () => {
    const { store, target, other, args } = await setup();
    expect(await removeUserAsOwner(store, args(target.id, " target@example.com "))).toBe("removed");
    expect(await store.getUser(target.id)).toBeNull();
    expect(await store.findProfile(target.id)).toBeNull();
    expect(await store.listJobs(target.id)).toEqual([]);
    expect(await store.getUser(other.id)).not.toBeNull();
    expect(await store.findProfile(other.id)).not.toBeNull();
    expect(await store.listJobs(other.id)).toHaveLength(1);
  });

  it("does nothing when the typed email is wrong", async () => {
    const { store, target, args } = await setup();
    expect(await removeUserAsOwner(store, args(target.id, "someone@else.com"))).toBe("mismatch");
    expect(await removeUserAsOwner(store, args(target.id, ""))).toBe("mismatch");
    expect(await store.getUser(target.id)).not.toBeNull();
  });

  it("never removes the owner's own account", async () => {
    const { store, owner, args } = await setup();
    expect(await removeUserAsOwner(store, args(owner.id, "owner@example.com"))).toBe("protected");
    expect(await store.getUser(owner.id)).not.toBeNull();
  });

  it("says so when the account is already gone, and drops a viewer's dashboard access with the account", async () => {
    const { store, target, args } = await setup();
    await store.addAdminUser(target.id, "owner");
    expect(await removeUserAsOwner(store, args(target.id, "target@example.com"))).toBe("removed");
    expect(await store.isAdminUser(target.id)).toBe(false);
    expect(await removeUserAsOwner(store, args(target.id, "target@example.com"))).toBe("not_found");
  });
});
