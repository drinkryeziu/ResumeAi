import { describe, expect, it } from "vitest";
import { JobSearchError, parseGoogleJobs, queryFor, searchJobs, titleForSearch } from "@/server/jobs/search";

const row = (over: Record<string, unknown> = {}) => ({
  title: "Senior UX Designer",
  company_name: "Northwind Financial",
  location: "Charlotte, NC",
  via: "via LinkedIn",
  share_link: "https://www.google.com/search?q=x&ibp=htl;jobs",
  apply_options: [{ title: "Apply on LinkedIn", link: "https://www.linkedin.com/jobs/view/123" }],
  ...over,
});

describe("what to search for", () => {
  it("uses the job title alone, not the list of keywords after it", () => {
    expect(titleForSearch("Senior UX/UI Designer · Product Designer · Design Systems · Accessibility (ADA/WCAG)")).toBe("Senior UX/UI Designer");
    expect(titleForSearch("Product Manager, Payments")).toBe("Product Manager");
    expect(titleForSearch("Designer | Researcher")).toBe("Designer");
    expect(titleForSearch("  Data   Analyst ")).toBe("Data Analyst");
    expect(titleForSearch(null)).toBe("");
  });

  it("asks for the title near the person's city and state, or their country, or nowhere in particular", () => {
    expect(queryFor({ headline: "Senior Product Designer", city: "Cornelius", state: "NC", country: "United States" })).toBe("Senior Product Designer jobs in Cornelius, NC");
    expect(queryFor({ headline: "Designer", city: "Berlin", country: "Germany" })).toBe("Designer jobs in Berlin");
    expect(queryFor({ headline: "Designer", country: "Germany" })).toBe("Designer jobs in Germany");
    expect(queryFor({ headline: "Designer" })).toBe("Designer jobs");
    expect(queryFor({ headline: "  ", city: "Berlin" })).toBeNull();
  });

  it("sends nothing but the title and the place", () => {
    const q = queryFor({ headline: "Designer", city: "Cornelius", state: "NC", country: "United States" })!;
    expect(q).not.toMatch(/@|\d{3}/);
  });
});

describe("reading the search answer", () => {
  it("lists title, company, place, site and an https link for each opening, at most five", () => {
    const jobs = parseGoogleJobs({ jobs_results: Array.from({ length: 8 }, (_, i) => row({ title: `Designer ${i}`, apply_options: [{ link: `https://jobs.example.com/${i}` }] })) });
    expect(jobs).toHaveLength(5);
    expect(jobs[0]).toEqual({ title: "Designer 0", company: "Northwind Financial", location: "Charlotte, NC", url: "https://jobs.example.com/0", via: "LinkedIn" });
  });

  it("prefers the apply link and falls back to the share link", () => {
    expect(parseGoogleJobs({ jobs_results: [row({ apply_options: [] })] })[0]!.url).toContain("google.com/search");
    expect(parseGoogleJobs({ jobs_results: [row({ apply_options: [{ link: "http://insecure.example.com" }, { link: "https://ok.example.com/a" }] })] })[0]!.url).toBe("https://ok.example.com/a");
  });

  it("drops what is incomplete, unsafe or repeated, and never makes anything up", () => {
    const jobs = parseGoogleJobs({
      jobs_results: [
        row({ title: "" }),
        row({ company_name: undefined }),
        row({ apply_options: [{ link: "javascript:alert(1)" }], share_link: "not a url" }),
        row({ apply_options: [{ link: "http://plain.example.com" }], share_link: undefined }),
        row({ title: "Good one" }),
        row({ title: "good ONE", company_name: "northwind financial" }),
      ],
    });
    expect(jobs.map((j) => j.title)).toEqual(["Good one"]);
    expect(parseGoogleJobs({})).toEqual([]);
    expect(parseGoogleJobs(null)).toEqual([]);
  });
});

describe("asking the search service", () => {
  const answer = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("returns the openings, and asks only for Google Jobs with the query and the key", async () => {
    let seen = "";
    const f = (async (u: string) => {
      seen = u;
      return new Response(JSON.stringify({ jobs_results: [row()] }));
    }) as unknown as typeof fetch;
    const jobs = await searchJobs("Designer jobs in Cornelius, NC", "KEY", f);
    expect(jobs).toHaveLength(1);
    expect(seen).toContain("engine=google_jobs");
    expect(seen).toContain("q=Designer+jobs+in+Cornelius%2C+NC");
  });

  it("says nothing was found when Google had no results, and raises a real error for anything else", async () => {
    expect(await searchJobs("x", "k", answer({ error: "Google hasn't returned any results for this query." }))).toEqual([]);
    await expect(searchJobs("x", "k", answer({ error: "Invalid API key." }, 401))).rejects.toBeInstanceOf(JobSearchError);
    await expect(searchJobs("x", "k", (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch)).rejects.toThrow(/could not be reached/);
  });
});
