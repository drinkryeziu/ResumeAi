import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { MemoryAppStore } = await import("@/server/store/memory");
const { completePasswordReset, hashToken, isResetTokenValid, requestPasswordReset } = await import("@/server/auth/password-reset");
const { hashPassword, verifyPassword } = await import("@/server/auth/password");

const tokenFrom = (text: string) => /token=([\w-]+)/.exec(text)![1]!;

async function setup() {
  const store = new MemoryAppStore();
  const user = await store.createUser({ email: "ada@example.com", name: "Ada Lovelace", passwordHash: await hashPassword("old-password") });
  const sent: Array<{ to: string; subject: string; text: string }> = [];
  const send = async (e: { to: string; subject: string; text: string }) => void sent.push(e);
  return { store, user, sent, send };
}

describe("password reset", () => {
  it("emails a one-time link that sets a new password, once", async () => {
    const { store, user, sent, send } = await setup();
    const now = new Date("2026-03-01T09:00:00Z");
    await requestPasswordReset(store, "Ada@Example.com", "https://app.example.com/", send, now);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("ada@example.com");
    expect(sent[0]!.text).toContain("https://app.example.com/reset-password?token=");
    const token = tokenFrom(sent[0]!.text);

    expect(await isResetTokenValid(store, token, now)).toBe(true);
    expect(await completePasswordReset(store, token, "a-brand-new-password", now)).toBe(true);
    expect(await verifyPassword("a-brand-new-password", (await store.getUser(user.id))!.passwordHash!)).toBe(true);
    expect(await verifyPassword("old-password", (await store.getUser(user.id))!.passwordHash!)).toBe(false);

    expect(await isResetTokenValid(store, token, now)).toBe(false);
    expect(await completePasswordReset(store, token, "another-password-1", now)).toBe(false); // already used
  });

  it("stores only a hash of the token", async () => {
    const { store, user, sent, send } = await setup();
    await requestPasswordReset(store, "ada@example.com", "https://x", send);
    const token = tokenFrom(sent[0]!.text);
    expect(await store.findPasswordReset(token, new Date())).toBeNull(); // the raw token is not what is stored
    expect(await store.findPasswordReset(hashToken(token), new Date())).toEqual({ userId: user.id });
  });

  it("expires after an hour", async () => {
    const { store, sent, send } = await setup();
    const now = new Date("2026-03-01T09:00:00Z");
    await requestPasswordReset(store, "ada@example.com", "https://x", send, now);
    const token = tokenFrom(sent[0]!.text);
    const later = new Date(+now + 61 * 60_000);
    expect(await isResetTokenValid(store, token, later)).toBe(false);
    expect(await completePasswordReset(store, token, "a-brand-new-password", later)).toBe(false);
  });

  it("says nothing different for an unknown email, and sends nothing", async () => {
    const { store, sent, send } = await setup();
    await expect(requestPasswordReset(store, "nobody@example.com", "https://x", send)).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it("does not send a second email within a minute, and the newest link replaces the older one", async () => {
    const { store, sent, send } = await setup();
    const t0 = new Date("2026-03-01T09:00:00Z");
    await requestPasswordReset(store, "ada@example.com", "https://x", send, t0);
    await requestPasswordReset(store, "ada@example.com", "https://x", send, new Date(+t0 + 30_000));
    expect(sent).toHaveLength(1);
    await requestPasswordReset(store, "ada@example.com", "https://x", send, new Date(+t0 + 90_000));
    expect(sent).toHaveLength(2);
    const [first, second] = sent.map((s) => tokenFrom(s.text));
    const when = new Date(+t0 + 100_000);
    expect(await isResetTokenValid(store, first!, when)).toBe(false);
    expect(await isResetTokenValid(store, second!, when)).toBe(true);
  });

  it("keeps the account safe when the email provider fails", async () => {
    const { store, user } = await setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(requestPasswordReset(store, "ada@example.com", "https://x", async () => Promise.reject(new Error("provider down")))).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    expect(await verifyPassword("old-password", (await store.getUser(user.id))!.passwordHash!)).toBe(true);
    error.mockRestore();
  });
});
