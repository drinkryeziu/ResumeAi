import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatNumber } from "@/lib/format";
import { requireProfile } from "@/server/auth/session";
import { DEFAULT_CREDIT_PACKS, DEFAULT_PLANS } from "@/server/billing/catalog";
import { getStore } from "@/server/store";

export const metadata = { title: "Credits" };

const REASON: Record<string, { label: string; tone: "info" | "success" | "neutral" }> = {
  GRANT: { label: "Added", tone: "success" },
  PURCHASE: { label: "Purchased", tone: "success" },
  CONSUME: { label: "Used", tone: "info" },
  REFUND: { label: "Refunded", tone: "success" },
  EXPIRE: { label: "Expired", tone: "neutral" },
  ADJUST: { label: "Adjusted", tone: "neutral" },
};

/** Only our own job pages: the saved work the credit-limit window sent the person from. */
const SAVED_WORK = /^\/(jobs\/[A-Za-z0-9_-]+|dashboard)$/;

export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const backTo = from && SAVED_WORK.test(from) ? from : null;
  const { user } = await requireProfile();
  const store = await getStore();
  const [balance, prices, history] = await Promise.all([store.credits.balance(user.id), store.credits.listPrices(), store.credits.history(user.id, 50)]);
  const label = new Map(prices.map((p) => [p.key, p.label]));
  const money = (c: number) => (c === 0 ? "Free" : `$${(c / 100).toFixed(2)}`);

  return (
    <>
      <PageHeader title="Credits" description="AI actions use credits. You always see the cost on the button before you click, and failed actions are refunded automatically." />
      {backTo && (
        <Card tone="green" className="mb-ds-4 flex flex-wrap items-center justify-between gap-ds-3">
          <p className="text-body-sm">When you have enough credits, go back to where you stopped and continue.</p>
          <ButtonLink href={backTo} variant="secondary">
            Back to your work
          </ButtonLink>
        </Card>
      )}
      <div className="grid gap-ds-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-ds-4">
          <Card>
            <p className="text-body-sm">Available credits</p>
            <p className="text-display-hero text-blue-600">{formatNumber(balance)}</p>
          </Card>
          <Card>
            <CardHeader title="What things cost" />
            <table className="w-full text-body-sm">
              <tbody>
                {prices
                  .filter((p) => p.active)
                  .map((p) => (
                    <tr key={p.key} className="border-b border-gray-100 last:border-0">
                      <td className="py-ds-2">{p.label}</td>
                      <td className="py-ds-2 text-right text-label-bold">{p.credits === 0 ? "Free" : `${p.credits} credits`}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <CardHeader title="Plans" subtitle="Checkout arrives with billing in phase 5." />
            <ul className="flex flex-col gap-ds-2 text-body-sm">
              {DEFAULT_PLANS.map((p) => (
                <li key={p.key} className="flex justify-between">
                  <span className="text-label-bold">{p.name}</span>
                  <span>
                    {money(p.priceCents)}
                    {p.interval === "MONTH" ? "/month" : ""} · {p.monthlyCredits ? `${p.monthlyCredits} credits/month` : `${p.signupCredits} credits to start`}
                  </span>
                </li>
              ))}
              {DEFAULT_CREDIT_PACKS.map((p) => (
                <li key={p.name} className="flex justify-between">
                  <span>Buy {p.name}</span>
                  <span>{money(p.priceCents)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card>
          <CardHeader title="History" />
          {history.length === 0 ? (
            <p className="text-body-sm">No activity yet.</p>
          ) : (
            <table className="w-full text-body-sm">
              <thead>
                <tr className="text-left text-label-bold">
                  <th className="pb-ds-2">Date</th>
                  <th className="pb-ds-2">Activity</th>
                  <th className="pb-ds-2 text-right">Credits</th>
                  <th className="pb-ds-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {history.map((e) => (
                  <tr key={e.id} className="border-t border-gray-100">
                    <td className="py-ds-2">{formatDate(e.createdAt)}</td>
                    <td className="py-ds-2">
                      <Badge tone={REASON[e.reason]?.tone}>{REASON[e.reason]?.label}</Badge> {e.actionKey ? label.get(e.actionKey) : e.note}
                    </td>
                    <td className={`py-ds-2 text-right text-label-bold ${e.delta > 0 ? "text-success" : ""}`}>{e.delta > 0 ? `+${e.delta}` : e.delta}</td>
                    <td className="py-ds-2 text-right">{formatNumber(e.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
