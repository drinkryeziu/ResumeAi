import { X } from "lucide-react";
import { LegalLinks } from "@/components/features/legal/LegalLinks";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, SoftPanel } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import {
  ACTION_ROWS,
  centsPerCredit,
  costOf,
  FREE_PLAN,
  FULL_APPLICATION_CREDITS,
  launchOfferCredits,
  outcomeOf,
  PACKS,
  PAID_PLANS,
  usd,
  usdSmall,
} from "@/lib/pricing-details";

export const metadata = { title: "Pricing details", description: "What every step costs in credits and in dollars, and what each plan lets you do." };

const perCredit = PAID_PLANS.map((p) => centsPerCredit(p.priceCents, p.monthlyCredits));
const offer = launchOfferCredits();
const free = outcomeOf(FREE_PLAN.signupCredits);
const withOffer = outcomeOf(FREE_PLAN.signupCredits + offer);

/** Public page behind "See details" in the first page's Pricing section: the whole price list in plain tables. */
export default function PricingDetailsPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-[1120px] px-ds-4 py-ds-5 md:px-ds-5">
        <div className="mb-ds-5 flex flex-wrap items-start justify-between gap-ds-4">
          <div className="flex max-w-2xl flex-col gap-ds-2">
            <h1 className="text-heading-section">Pricing details</h1>
            <p className="text-body">
              Every step that uses AI costs credits, and you see the price on the button before you click. Reading your CV, creating and updating your profile are free.
            </p>
          </div>
          <ButtonLink href="/" variant="secondary" icon={<X size={16} aria-hidden="true" />}>
            Close
          </ButtonLink>
        </div>

        <div className="flex flex-col gap-ds-4">
          <Card aria-labelledby="credit-h">
            <CardHeader title={<span id="credit-h">What a credit costs</span>} subtitle="The more credits a plan gives you, the less each one costs." />
            <DataTable
              caption="Plans and what one credit costs on each"
              columns={[
                { key: "plan", label: "Plan" },
                { key: "price", label: "Price", align: "right" },
                { key: "credits", label: "Credits", align: "right" },
                { key: "per", label: "Cost per credit", align: "right" },
              ]}
              rows={[
                { id: "free", cells: { plan: FREE_PLAN.name, price: "Free", credits: `${FREE_PLAN.signupCredits} to start`, per: "—" } },
                ...PAID_PLANS.map((p, i) => ({
                  id: p.key,
                  cells: { plan: p.name, price: `${usd(p.priceCents)}/month`, credits: `${p.monthlyCredits.toLocaleString("en-US")} per month`, per: usdSmall(perCredit[i]!) },
                })),
                ...PACKS.map((k) => ({ id: k.name, cells: { plan: `Extra pack: ${k.name}`, price: usd(k.priceCents), credits: `${k.credits} once`, per: usdSmall(centsPerCredit(k.priceCents, k.credits)) } })),
              ]}
            />
          </Card>

          <Card aria-labelledby="action-h">
            <CardHeader title={<span id="action-h">What each step costs</span>} subtitle="In credits, and in dollars on each paid plan." />
            <DataTable
              caption="Steps, their credits and their price on each paid plan"
              columns={[
                { key: "step", label: "Step" },
                { key: "credits", label: "Credits", align: "right" },
                ...PAID_PLANS.map((p) => ({ key: p.key, label: p.name, align: "right" as const })),
              ]}
              rows={ACTION_ROWS.map((r) => ({
                id: r.id,
                emphasis: r.emphasis,
                cells: {
                  step: (
                    <span className="flex flex-col">
                      <span>{r.label}</span>
                      <span className="text-caption font-normal">{r.detail}</span>
                    </span>
                  ),
                  credits: r.credits === 0 ? "Free" : r.credits,
                  ...Object.fromEntries(PAID_PLANS.map((p, i) => [p.key, costOf(r.credits, perCredit[i]!)])),
                },
              }))}
            />
          </Card>

          <Card aria-labelledby="plan-h">
            <CardHeader title={<span id="plan-h">What you can do with each plan</span>} subtitle={`One full application is ${FULL_APPLICATION_CREDITS} credits: tailor to a job, then create the application.`} />
            <DataTable
              caption="What each plan's credits pay for"
              columns={[
                { key: "plan", label: "Plan" },
                { key: "credits", label: "Credits", align: "right" },
                { key: "apps", label: "Full applications", align: "right" },
                { key: "left", label: "Credits left over", align: "right" },
              ]}
              rows={[
                { id: "free", cells: { plan: `${FREE_PLAN.name} (to start)`, credits: free.credits, apps: free.applications, left: free.left } },
                ...(offer > 0 ? [{ id: "offer", cells: { plan: `${FREE_PLAN.name} with the launch offer`, credits: withOffer.credits, apps: withOffer.applications, left: withOffer.left } }] : []),
                ...PAID_PLANS.map((p) => {
                  const o = outcomeOf(p.monthlyCredits);
                  return { id: p.key, cells: { plan: `${p.name}, each month`, credits: o.credits.toLocaleString("en-US"), apps: o.applications, left: o.left } };
                }),
              ]}
            />
          </Card>

          <SoftPanel className="flex flex-col gap-ds-2">
            <h2 className="text-card-title">Good to know</h2>
            <ul className="flex list-disc flex-col gap-ds-1 pl-5 text-body-sm">
              <li>If an AI step fails, its credits are refunded automatically.</li>
              <li>The price is on the button before you click it, so there are no surprises.</li>
              <li>
                Smaller steps add up: after your first application, a cover letter tweak costs {ACTION_ROWS.find((r) => r.id === "tone")!.credits} credits and an ATS check{" "}
                {ACTION_ROWS.find((r) => r.id === "ats")!.credits}.
              </li>
              {offer > 0 && <li>Launch offer: new accounts get {offer} extra credits on top of the {FREE_PLAN.signupCredits} free ones, for as long as the offer lasts.</li>}
              <li>Paid plans and extra packs are not open for purchase yet. Every new account starts with free credits.</li>
            </ul>
          </SoftPanel>

          <div className="flex flex-wrap items-center gap-ds-4">
            <ButtonLink href="/sign-up">Get started free</ButtonLink>
            <ButtonLink href="/" variant="secondary" icon={<X size={16} aria-hidden="true" />}>
              Close
            </ButtonLink>
          </div>
        </div>

        <p className="text-body-sm mt-ds-6">
          <LegalLinks />
        </p>
      </main>
    </>
  );
}
