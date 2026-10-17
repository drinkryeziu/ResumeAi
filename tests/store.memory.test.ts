import { vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.AI_FORCE_MOCK = "true";

import { storeContract } from "./store-contract";

const { MemoryAppStore } = await import("@/server/store/memory");

storeContract("in-memory", async () => ({ store: new MemoryAppStore(), close: async () => {} }));
