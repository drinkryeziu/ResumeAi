import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { jobSuggestionsFor, SUGGESTIONS_FRESH_DAYS } = await import("@/server/jobs/suggest");
const { MemoryAppStore } = await import("@/server/store/memory");

afterEach(() => vi.unstubAllEnvs());

const profile = { headline: "Senior Product Designer", city: "Cornelius", state: "NC", country: "United States" };
const job = (n: number) => ({ title: `Designer ${n}`, company_name: "Northwind", location: "Charlotte, NC", via: "via LinkedIn", apply_options: [{ link: `https://jobs.example.com/${n}` }] });
const serp = (n = 7) => {
  const calls: string[] = [];
  const f = (async (u: string) => {
    calls.push(u);
    return new Response(JSON.stringify({ jobs_results: Array.from({ length: n }, (_, i) => job(i)) }));
  }) as unknown as typeof fetch;
  return { f, calls };
};

describe("job suggestions after the Master documents", () => {
  it("does nothing, and asks nobody, until a search key is set", async () => {
    const store = new MemoryAppStore();
    const { f, calls } = serp();
    expect(await jobSuggestionsFor(store, "u1", profile, { fetchImpl: f })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("finds five openings from the job title and city, keeps them, and does not search again for a week", async () => {
    vi.stubEnv("SERPAPI_API_KEY", "test-key");
    const store = new MemoryAppStore();
    const { f, calls } = serp();
    const now = new Date("2026-10-23T10:00:00Z");
    const first = (await jobSuggestionsFor(store, "u1", profile, { now, fetchImpl: f }))!;
    expect(first.jobs).toHaveLength(5);
    expect(first.query).toBe("Senior Product Designer jobs in Cornelius, NC");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("Senior+Product+Designer+jobs+in+Cornelius%2C+NC");
    expect(calls[0]).not.toMatch(/@|alex/i);

    await jobSuggestionsFor(store, "u1", profile, { now: new Date(+now + (SUGGESTIONS_FRESH_DAYS - 1) * 86_400_000), fetchImpl: f });
    expect(calls).toHaveLength(1); // still fresh: kept openings, no new search
    await jobSuggestionsFor(store, "u1", profile, { now: new Date(+now + (SUGGESTIONS_FRESH_DAYS + 1) * 86_400_000), fetchImpl: f });
    expect(calls).toHaveLength(2); // a week later it looks again
  });

  it("searches again when the job title or city changed", async () => {
    vi.stubEnv("SERPAPI_API_KEY", "test-key");
    const store = new MemoryAppStore();
    const { f, calls } = serp();
    await jobSuggestionsFor(store, "u1", profile, { fetchImpl: f });
    await jobSuggestionsFor(store, "u1", { ...profile, city: "Raleigh" }, { fetchImpl: f });
    expect(calls).toHaveLength(2);
  });

  it("never breaks the page when the search fails: it notes the problem for the admin and shows what it has", async () => {
    vi.stubEnv("SERPAPI_API_KEY", "bad-key");
    const store = new MemoryAppStore();
    const failing = (async () => new Response(JSON.stringify({ error: "Invalid API key." }), { status: 401 })) as unknown as typeof fetch;
    expect(await jobSuggestionsFor(store, "u1", profile, { fetchImpl: failing })).toBeNull();
    const { entries } = await store.errorSummary(new Date(0));
    expect(entries[0]).toMatchObject({ source: "job_suggestions", code: "search_401", userId: "u1" });
    expect(entries[0]!.message).not.toContain("bad-key");
  });

  it("has nothing to search for without a job title", async () => {
    vi.stubEnv("SERPAPI_API_KEY", "test-key");
    const { f, calls } = serp();
    expect(await jobSuggestionsFor(new MemoryAppStore(), "u1", { ...profile, headline: "" }, { fetchImpl: f })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("limits how many searches one person can start in a day", async () => {
    vi.stubEnv("SERPAPI_API_KEY", "test-key");
    const store = new MemoryAppStore();
    const { f, calls } = serp();
    for (let i = 0; i < 9; i++) await jobSuggestionsFor(store, "u1", { ...profile, city: `City ${i}` }, { fetchImpl: f });
    expect(calls.length).toBe(5);
  });
});
