import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { ENTRIES, STARTERS, byId } = await import("@/lib/ask-drin/knowledge");
const { reply, tokens } = await import("@/lib/ask-drin/match");
const { askDrinFacts } = await import("@/server/ask-drin-facts");

const facts = askDrinFacts();

describe("Ask Drin", () => {
  it("answers each ready-made question with its own entry", () => {
    for (const e of ENTRIES) expect(reply(e.question, facts).id, e.question).toBe(e.id);
  });

  it("understands everyday wording", () => {
    const id = (q: string) => reply(q, facts).id;
    expect(id("how can i register for an account?")).toBe("account");
    expect(id("i forgot my password")).toBe("signin");
    expect(id("how much is it per month")).toBeOneOf(["cost", "plans"]);
    expect(id("can i get a pdf of my cover letter")).toBe("download");
    expect(id("do you sell my information?")).toBe("privacy");
    expect(id("does it lie about my experience")).toBe("invent");
    expect(id("will it apply for me")).toBe("apply");
    expect(id("my pdf upload failed")).toBe("upload-problem");
  });

  it("says plainly when it does not know, and offers things to ask", () => {
    for (const q of ["", "   ", "what is the capital of France", "asdf qwer zxcv", "tell me a joke"]) {
      const r = reply(q, facts);
      expect(r.id).toBeNull();
      expect(r.text).toMatch(/don't have an answer/i);
      expect(r.related.length).toBeGreaterThan(0);
    }
  });

  it("quotes the price list, not numbers typed into the answers", () => {
    const cost = reply("How much does it cost?", facts).text;
    expect(cost).toContain(`${facts.fullApplicationCredits} credits`);
    expect(cost).toContain(`${facts.signupCredits} free credits`);
    const plans = reply("What plans are there?", facts).text;
    for (const p of facts.plans) expect(plans).toContain(p.price);
    const changed = { ...facts, signupCredits: 999 };
    expect(reply("How many free credits do I get?", changed).text).toContain("999");
  });

  it("keeps its promises small: no guarantees, no jargon, no emoji", () => {
    const all = ENTRIES.flatMap((e) => [e.question, e.answer(facts)]).join(" ");
    expect(all).not.toMatch(/\b(LLM|tokens?|prompt|agent)\b/i);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/you will (get|be) (hired|an interview)|guaranteed to/i);
    expect(reply("Will my resume pass the ATS?", facts).text).toMatch(/can't promise/);
  });

  it("only links to pages of the app", () => {
    for (const e of ENTRIES) if (e.link) expect(e.link.href).toMatch(/^\/[\w#/-]*$/);
  });

  it("has a short list of starters that all exist", () => {
    expect(STARTERS.length).toBeGreaterThanOrEqual(6);
    for (const id of STARTERS) expect(byId(id)).toBeDefined();
  });

  it("reads words the same with apostrophes and endings", () => {
    expect(tokens("Don't uploading")).toEqual(tokens("dont uploads"));
  });
});
