import { describe, expect, it } from "vitest";
import { DEFAULT_CREDIT_ACTIONS } from "@/server/billing/catalog";
import { ACTION_ROWS, centsPerCredit, costOf, creditsFor, FREE_PLAN, FULL_APPLICATION_CREDITS, launchOfferCredits, outcomeOf, PAID_PLANS, PACKS, usd, usdSmall } from "@/lib/pricing-details";

describe("pricing details", () => {
  it("reads every price from the price list: one full application is 35 credits, as the first page says", () => {
    expect(FULL_APPLICATION_CREDITS).toBe(35);
    expect(creditsFor("ANALYZE_JOB", "JOB_MATCH")).toBe(10);
    expect(creditsFor("OPTIMIZE_RESUME", "GENERATE_COVER_LETTER")).toBe(25);
    for (const a of DEFAULT_CREDIT_ACTIONS) expect(creditsFor(a.key)).toBe(a.credits);
  });

  it("lists profile and Master documents as free, and every paid step with its credits", () => {
    const by = (id: string) => ACTION_ROWS.find((r) => r.id === id)!;
    expect(["profile", "masters", "update", "hand"].map((id) => by(id).credits)).toEqual([0, 0, 0, 0]);
    expect(by("full").emphasis).toBe(true);
    expect(by("ats").credits).toBe(3);
    expect(by("tone").credits).toBe(3);
    expect(by("rewrite").credits).toBe(10);
  });

  it("works out what a credit costs on each plan and in each pack", () => {
    expect(PAID_PLANS.map((p) => usdSmall(centsPerCredit(p.priceCents, p.monthlyCredits)))).toEqual(["$0.033", "$0.025", "$0.020"]);
    expect(PACKS.map((p) => usdSmall(centsPerCredit(p.priceCents, p.credits)))).toEqual(["$0.050", "$0.040"]);
  });

  it("prices an action on a plan, and says Free for nothing", () => {
    const [starter, pro, premium] = PAID_PLANS.map((p) => centsPerCredit(p.priceCents, p.monthlyCredits));
    expect(costOf(35, starter!)).toBe("$1.17");
    expect(costOf(35, pro!)).toBe("$0.87"); // 35 x 2.49875 cents; rounding the credit to 2.5 cents first would say $0.88
    expect(costOf(35, premium!)).toBe("$0.70");
    expect(costOf(0, pro!)).toBe("Free");
    expect(usd(999)).toBe("$9.99");
  });

  it("says how many full applications each plan pays for", () => {
    expect(PAID_PLANS.map((p) => outcomeOf(p.monthlyCredits))).toEqual([
      { credits: 300, applications: 8, left: 20 },
      { credits: 800, applications: 22, left: 30 },
      { credits: 1500, applications: 42, left: 30 },
    ]);
    expect(outcomeOf(FREE_PLAN.signupCredits)).toEqual({ credits: 60, applications: 1, left: 25 });
  });

  it("knows the launch offer for everyone, and ignores gifts to one person", () => {
    expect(launchOfferCredits()).toBe(150);
  });
});
