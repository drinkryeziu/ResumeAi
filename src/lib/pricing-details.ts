import { DEFAULT_CREDIT_ACTIONS, DEFAULT_CREDIT_PACKS, DEFAULT_PLANS, type CreditActionKey } from "@/server/billing/catalog";
import { PROMOTIONS } from "@/server/billing/promotions";

/**
 * The numbers on the Pricing details page, worked out from the price list itself, so the page can never disagree with what the
 * buttons charge. Money is in cents until it is printed.
 */
const price = new Map<CreditActionKey, number>(DEFAULT_CREDIT_ACTIONS.map((a) => [a.key, a.credits]));
export const creditsFor = (...keys: CreditActionKey[]) => keys.reduce((sum, k) => sum + (price.get(k) ?? 0), 0);

export const TAILOR: CreditActionKey[] = ["ANALYZE_JOB", "JOB_MATCH"];
export const CREATE: CreditActionKey[] = ["OPTIMIZE_RESUME", "GENERATE_COVER_LETTER"];
/** Tailor to a job, then create the application: what "one application" means on the page. */
export const FULL_APPLICATION_CREDITS = creditsFor(...TAILOR, ...CREATE);

export const PAID_PLANS = DEFAULT_PLANS.filter((p) => p.priceCents > 0);
export const FREE_PLAN = DEFAULT_PLANS.find((p) => p.priceCents === 0)!;
export const PACKS = DEFAULT_CREDIT_PACKS;

/** Cents one credit costs on a plan or in a pack. */
export const centsPerCredit = (priceCents: number, credits: number) => priceCents / credits;

/** "$9.99". */
export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
/** "$0.033" for the price of one credit. */
export const usdSmall = (cents: number) => `$${(cents / 100).toFixed(3)}`;
/** What `credits` cost on a plan whose credit costs `perCredit` cents; "Free" for nothing. */
export const costOf = (credits: number, perCredit: number) => (credits === 0 ? "Free" : usd(credits * perCredit));

export interface ActionRow {
  id: string;
  label: string;
  detail: string;
  credits: number;
  /** The row to look at first. */
  emphasis?: boolean;
}

export const ACTION_ROWS: ActionRow[] = [
  { id: "profile", label: "Create your profile", detail: "Type it in, or import your CV.", credits: creditsFor("PARSE_RESUME") },
  { id: "update", label: "Create or update your profile", detail: "Any time. Your career summary is refreshed with it.", credits: creditsFor("MASTER_RESUME", "MASTER_COVER_LETTER") },
  { id: "tailor", label: "Tailor to a job", detail: "Reads the job and shows how you match.", credits: creditsFor(...TAILOR) },
  { id: "create", label: "Create the application", detail: "A resume and a cover letter written for that job.", credits: creditsFor(...CREATE) },
  { id: "full", label: "One full application", detail: "Tailor to a job, then create the application.", credits: FULL_APPLICATION_CREDITS, emphasis: true },
  { id: "match", label: "Check the match again", detail: "After you answer a question or change your profile.", credits: creditsFor("JOB_MATCH") },
  { id: "ats", label: "ATS check", detail: "Structure and keyword coverage of a resume.", credits: creditsFor("ATS_CHECK") },
  { id: "improve", label: "Improve the resume", detail: "A new version, using what the ATS check found.", credits: creditsFor("OPTIMIZE_RESUME") },
  { id: "tone", label: "Shorten, expand or change the tone of a cover letter", detail: "Saved as a new version.", credits: creditsFor("EDIT_COVER_LETTER") },
  { id: "rewrite", label: "Write the whole cover letter again", detail: "A fresh draft.", credits: creditsFor("GENERATE_COVER_LETTER") },
  { id: "hand", label: "Edit by hand, download, tick Applied", detail: "PDF, Word or both together.", credits: 0 },
];

export interface PlanOutcome {
  credits: number;
  /** How many full applications the credits pay for, and what is left after them. */
  applications: number;
  left: number;
}
export const outcomeOf = (credits: number): PlanOutcome => ({ credits, applications: Math.floor(credits / FULL_APPLICATION_CREDITS), left: credits % FULL_APPLICATION_CREDITS });

/** Credits every new account gets on top of the free ones while a launch offer for everyone is on (0 when it is off). */
export const launchOfferCredits = () => PROMOTIONS.filter((p) => p.active && !p.emails).reduce((sum, p) => sum + p.credits, 0);
