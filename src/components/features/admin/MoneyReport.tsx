import { PiggyBank, Receipt, Scale, Wallet } from "lucide-react";
import { removeRunningCost } from "@/app/(app)/admin/actions";
import { SoftPanel } from "@/components/ui/Card";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { DataTable } from "@/components/ui/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { formatDate, formatNumber } from "@/lib/format";
import { centsPerCredit, PACKS, PAID_PLANS } from "@/lib/pricing-details";
import { breakdown, money, moneyFine, OWNER_SHARE_PCT, purchasesToCoverFixed, type MonthReport, type Purchase, type RunningCost } from "@/server/admin/money";
import { AddRunningCostForm } from "./AddRunningCostForm";

const dash = "—";
const orDash = (cents: number | null) => (cents === null ? dash : money(cents));

/**
 * The owner's money report, last 30 days: what came in, the owner's 20%, what the app cost to run (AI used by everyone, free credits
 * included, plus the fixed monthly costs the owner entered), and what is left. Then each plan and pack worked out the same way, and
 * every purchase with its own split. Owner only.
 */
export function MoneyReport({
  report,
  perCredit,
  purchases,
  runningCosts,
  days,
}: {
  report: MonthReport;
  /** AI cost of one credit in cents, from real usage; null until the AI has been used. */
  perCredit: number | null;
  purchases: Purchase[];
  runningCosts: RunningCost[];
  days: number;
}) {
  const sellable = [
    ...PAID_PLANS.map((p) => ({ id: p.key, name: `${p.name} (per month)`, cents: p.priceCents, credits: p.monthlyCredits })),
    ...PACKS.map((k) => ({ id: k.name, name: `Extra pack: ${k.name}`, cents: k.priceCents, credits: k.credits })),
  ];
  const fixed = report.fixed;
  return (
    <section aria-labelledby="money-h" className="flex flex-col gap-ds-3">
      <div>
        <h2 id="money-h" className="text-heading-section">
          Money
        </h2>
        <p className="text-body-sm">
          Last {days} days. Of every purchase, {OWNER_SHARE_PCT}% is yours. The rest pays for running the app: the AI behind the credits, and the fixed monthly costs below.
        </p>
      </div>

      <div className="grid gap-ds-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sales" value={money(report.revenue)} icon={<Wallet size={22} />} hint={`${formatNumber(purchases.length)} ${purchases.length === 1 ? "purchase" : "purchases"}`} />
        <StatCard label={`Your ${OWNER_SHARE_PCT}%`} value={money(report.owner)} icon={<PiggyBank size={22} />} hint={`${100 - OWNER_SHARE_PCT}% (${money(report.toCosts)}) is for costs`} />
        <StatCard
          label="Cost of running"
          value={money(report.ai + report.fixed)}
          icon={<Receipt size={22} />}
          hint={`AI ${money(report.ai)}, used by everyone, free credits too · fixed ${money(report.fixed)} a month`}
        />
        <StatCard
          label="Left after costs"
          value={money(report.left)}
          tone={report.covered ? "ok" : "bad"}
          icon={<Scale size={22} />}
          hint={report.covered ? `The ${100 - OWNER_SHARE_PCT}% covers the costs` : `The ${100 - OWNER_SHARE_PCT}% does not cover the costs yet`}
        />
      </div>

      <CollapsibleCard id="buys-h" title="Purchases" subtitle="Each one split the same way. Nothing here says who bought.">
        {purchases.length === 0 ? (
          <SoftPanel>
            <p className="text-body-sm">No purchases yet. Checkout isn&apos;t open, so nothing has been sold. Every purchase will appear here with its split.</p>
          </SoftPanel>
        ) : (
          <DataTable
            caption="Purchases in the last 30 days"
            columns={[
              { key: "when", label: "Date" },
              { key: "what", label: "What" },
              { key: "price", label: "Price", align: "right" },
              { key: "owner", label: `Your ${OWNER_SHARE_PCT}%`, align: "right" },
              { key: "rest", label: "For costs", align: "right" },
              { key: "ai", label: "AI cost of its credits", align: "right" },
            ]}
            rows={purchases.map((p) => {
              const b = breakdown(p, perCredit);
              return { id: p.id, cells: { when: formatDate(p.at), what: p.name, price: money(b.price), owner: money(b.owner), rest: money(b.toCosts), ai: orDash(b.ai) } };
            })}
          />
        )}
      </CollapsibleCard>

      <CollapsibleCard
        id="plans-money-h"
        title="Each plan and pack"
        subtitle={
          perCredit === null
            ? "The AI cost appears once people have used the AI. Until then only your 20% and the rest are shown."
            : `One credit costs about ${moneyFine(perCredit)} in AI, from real use in the last ${days} days. If every credit bought is used, this is what each sale leaves.`
        }
      >
        <DataTable
          caption="What each plan and pack leaves after your share and the AI"
          columns={[
            { key: "what", label: "Plan or pack" },
            { key: "price", label: "Price", align: "right" },
            { key: "owner", label: `Your ${OWNER_SHARE_PCT}%`, align: "right" },
            { key: "rest", label: "For costs", align: "right" },
            { key: "ai", label: "AI cost of its credits", align: "right" },
            { key: "left", label: "Left for fixed costs", align: "right" },
            { key: "need", label: "Sales a month to cover fixed costs", align: "right" },
          ]}
          rows={sellable.map((s) => {
            const b = breakdown(s, perCredit);
            const need = purchasesToCoverFixed(b.contribution, fixed);
            return {
              id: s.id,
              cells: {
                what: s.name,
                price: money(b.price),
                owner: money(b.owner),
                rest: money(b.toCosts),
                ai: orDash(b.ai),
                left: orDash(b.contribution),
                need: fixed === 0 ? "None needed" : b.contribution === null ? dash : need === null ? "Price too low" : formatNumber(need),
              },
            };
          })}
        />
      </CollapsibleCard>

      <CollapsibleCard id="running-h" title="Fixed monthly costs" subtitle="What it costs each month just to keep the app online, whether or not anyone buys: hosting, database, email, domain.">
        <div className="flex flex-col gap-ds-4">
          {runningCosts.length === 0 ? (
            <p className="text-body-sm">None entered yet. Add them so the report can tell whether the {100 - OWNER_SHARE_PCT}% is enough.</p>
          ) : (
            <ul className="flex flex-col gap-ds-2">
              {runningCosts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-ds-3 rounded-md bg-gray-100 px-ds-3 py-ds-2">
                  <span className="text-label-bold">{c.label}</span>
                  <span className="flex items-center gap-ds-4">
                    <span className="text-body-sm tabular-nums">{money(c.cents)} a month</span>
                    <form action={removeRunningCost}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" aria-label={`Remove ${c.label}`} className="text-body-sm text-danger underline">
                        Remove
                      </button>
                    </form>
                  </span>
                </li>
              ))}
              <li className="flex justify-between gap-ds-3 px-ds-3 text-label-bold">
                <span>Total</span>
                <span className="tabular-nums">{money(fixed)} a month</span>
              </li>
            </ul>
          )}
          <AddRunningCostForm />
        </div>
      </CollapsibleCard>
    </section>
  );
}
