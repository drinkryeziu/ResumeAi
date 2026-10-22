import { describe, expect, it } from "vitest";
import { aiCentsPerCredit, breakdown, money, moneyFine, monthReport, ownerShare, purchasesToCoverFixed } from "@/server/admin/money";

describe("the owner's 20%", () => {
  it("is a fifth of every payment, to the cent", () => {
    expect(ownerShare(1999)).toBe(400); // 399.8
    expect(ownerShare(999)).toBe(200); // 199.8
    expect(ownerShare(2999)).toBe(600); // 599.8
    expect(ownerShare(499)).toBe(100); // 99.8
    expect(ownerShare(0)).toBe(0);
  });
});

describe("what a credit costs in AI", () => {
  it("comes from real usage: every run's cost over the credits actually used, refunds taken off", () => {
    expect(aiCentsPerCredit(1.5, 1000, 0)).toBeCloseTo(0.15); // $1.50 over 1000 credits = 0.15 cents each
    expect(aiCentsPerCredit(1.5, 1000, 500)).toBeCloseTo(0.3); // half were refunded, the runs were still paid for
  });
  it("says nothing until something was used, instead of guessing", () => {
    expect(aiCentsPerCredit(0, 0, 0)).toBeNull();
    expect(aiCentsPerCredit(2, 100, 100)).toBeNull();
  });
});

describe("one purchase", () => {
  it("splits into the owner's 20%, the rest for costs, the AI the credits will use, and what is left", () => {
    const b = breakdown({ cents: 1999, credits: 800 }, 0.2); // 0.2 cents of AI per credit
    expect(b).toEqual({ price: 1999, owner: 400, toCosts: 1599, ai: 160, contribution: 1439 });
  });
  it("leaves the AI and what is left empty while there is no usage to go by", () => {
    expect(breakdown({ cents: 999, credits: 300 }, null)).toEqual({ price: 999, owner: 200, toCosts: 799, ai: null, contribution: null });
  });
  it("counts how many such purchases a month pay the fixed costs", () => {
    expect(purchasesToCoverFixed(1439, 5000)).toBe(4);
    expect(purchasesToCoverFixed(1439, 0)).toBe(0);
    expect(purchasesToCoverFixed(-10, 5000)).toBeNull(); // this price never covers them
    expect(purchasesToCoverFixed(null, 5000)).toBeNull();
  });
});

describe("the month", () => {
  it("adds revenue, the owner's 20%, AI used by everyone and the fixed costs, and says what is left", () => {
    const r = monthReport({ purchases: [{ cents: 1999 }, { cents: 999 }], aiCostUsd: 2.5, runningCosts: [{ cents: 2000 }, { cents: 500 }] });
    expect(r).toEqual({ revenue: 2998, owner: 600, toCosts: 2398, ai: 250, fixed: 2500, left: -352, covered: false });
  });
  it("with no sales the costs still show, as a loss", () => {
    const r = monthReport({ purchases: [], aiCostUsd: 1, runningCosts: [{ cents: 2000 }] });
    expect(r).toMatchObject({ revenue: 0, owner: 0, left: -2100, covered: false });
  });
  it("is covered when the 80% pays for everything", () => {
    expect(monthReport({ purchases: [{ cents: 10_000 }], aiCostUsd: 5, runningCosts: [{ cents: 3000 }] })).toMatchObject({ left: 4500, covered: true });
  });
});

describe("printing money", () => {
  it("shows dollars with cents, thousands, and a minus for a loss", () => {
    expect(money(123_450)).toBe("$1,234.50");
    expect(money(-352)).toBe("-$3.52");
    expect(money(0)).toBe("$0.00");
    expect(moneyFine(0.21)).toBe("$0.0021");
  });
});
