import "server-only";
import type { Facts } from "@/lib/ask-drin/facts";
import { creditsFor, CREATE, FULL_APPLICATION_CREDITS, launchOfferCredits, outcomeOf, PACKS, PAID_PLANS, FREE_PLAN, TAILOR, usd } from "@/lib/pricing-details";

/** What Ask Drin quotes, taken from the same price list the pricing page and the buttons use. */
export function askDrinFacts(): Facts {
  return {
    signupCredits: FREE_PLAN.signupCredits,
    launchCredits: launchOfferCredits(),
    tailorCredits: creditsFor(...TAILOR),
    createCredits: creditsFor(...CREATE),
    fullApplicationCredits: FULL_APPLICATION_CREDITS,
    matchCredits: creditsFor("JOB_MATCH"),
    atsCredits: creditsFor("ATS_CHECK"),
    coverEditCredits: creditsFor("EDIT_COVER_LETTER"),
    coverRewriteCredits: creditsFor("GENERATE_COVER_LETTER"),
    improveCredits: creditsFor("OPTIMIZE_RESUME"),
    plans: PAID_PLANS.map((p) => ({
      name: p.name,
      price: `${usd(p.priceCents)}/month`,
      credits: p.monthlyCredits,
      applications: outcomeOf(p.monthlyCredits).applications,
    })),
    packs: PACKS.map((k) => ({ name: k.name, price: usd(k.priceCents) })),
  };
}
