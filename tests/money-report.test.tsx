import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(app)/admin/actions", () => ({ addRunningCost: async () => undefined, removeRunningCost: async () => undefined }));

const { MoneyReport } = await import("@/components/features/admin/MoneyReport");
const { monthReport, aiCentsPerCredit } = await import("@/server/admin/money");

const purchases = [
  { id: "b1", at: new Date("2026-10-20T10:00:00Z"), kind: "PLAN" as const, name: "Pro", cents: 1999, credits: 800 },
  { id: "b2", at: new Date("2026-10-21T10:00:00Z"), kind: "PACK" as const, name: "100 credits", cents: 499, credits: 100 },
];
const runningCosts = [{ id: "c1", label: "Hosting", cents: 2000 }, { id: "c2", label: "Database", cents: 900 }];
const perCredit = aiCentsPerCredit(1.6, 1000, 0)!; // 0.16 cents a credit
const html = (p = purchases) => renderToStaticMarkup(<MoneyReport report={monthReport({ purchases: p, aiCostUsd: 1.6, runningCosts })} perCredit={perCredit} purchases={p} runningCosts={runningCosts} days={30} />);

describe("the owner's money report", () => {
  it("shows the month: sales, the owner's 20%, the cost of running and what is left", () => {
    const h = html();
    expect(h).toContain("$24.98"); // 1999 + 499 cents
    expect(h).toContain("$5.00"); // 20%: 400 + 100 cents
    expect(h).toContain("$30.60"); // AI $1.60 + fixed $29.00
    expect(h).toContain("-$10.62"); // 2498 - 500 - 160 - 2900 = -1062
    expect(h).toContain("does not cover the costs yet");
  });

  it("works out each plan: the 20%, what is left for costs, the AI of its credits and the sales a month needed", () => {
    const h = html();
    expect(h).toContain("Pro (per month)");
    expect(h).toContain("$4.00"); // Pro: 20% of $19.99
    expect(h).toContain("$15.99"); // the rest
    expect(h).toContain("$1.28"); // AI for 800 credits at 0.16 cents
    expect(h).toContain("$14.71"); // 1599 - 128
    expect(h).toMatch(/\$14\.71<\/td><td[^>]*>2</); // fixed $29.00 / $14.71 left per sale = 1.97, so 2 sales a month
  });

  it("lists every purchase with its own split, and says so when there are none", () => {
    expect(html()).toContain("100 credits");
    const empty = html([]);
    expect(empty).toContain("No purchases yet");
    expect(empty).toContain("Checkout isn&#x27;t open");
  });

  it("lists the fixed costs with their total", () => {
    const h = html();
    expect(h).toContain("Hosting");
    expect(h).toContain("$29.00 a month");
  });
});
