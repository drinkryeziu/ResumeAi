/**
 * The money rules for the owner's report, in one place so they can be tested. Everything is in cents (AI costs can be fractions of
 * a cent, so those stay fractional until they are printed).
 *
 * The rule the owner chose: of every purchase, 20% is the owner's. The other 80% is what pays for running the app: the AI that
 * the purchased credits will use, and the fixed monthly costs (hosting, database, email). The report shows whether 80% is enough.
 */
export const OWNER_SHARE_PCT = 20;

export interface Purchase {
  id: string;
  at: Date;
  kind: "PLAN" | "PACK";
  /** "Pro" or "500 credits". */
  name: string;
  cents: number;
  credits: number;
}
export type PurchaseInput = Omit<Purchase, "id">;

/** A fixed cost per month, such as hosting or the database. */
export interface RunningCost {
  id: string;
  label: string;
  cents: number;
}

/** The owner's 20% of one payment, to the whole cent. */
export const ownerShare = (cents: number) => Math.round((cents * OWNER_SHARE_PCT) / 100);

/**
 * What one credit really costs in AI, in cents, from real usage: the cost of every AI run (failed ones too, they were paid for)
 * over the credits people actually used (refunded ones don't count). Null when nothing was used yet, so nothing is guessed.
 */
export function aiCentsPerCredit(costUsd: number, consumed: number, refunded: number): number | null {
  const net = consumed - refunded;
  return net > 0 ? (costUsd * 100) / net : null;
}

export interface Breakdown {
  price: number;
  /** The owner's 20%. */
  owner: number;
  /** The rest: what pays for running the app. */
  toCosts: number;
  /** AI cost of using all the credits that were bought; null while there is no usage to go by. */
  ai: number | null;
  /** What is left of `toCosts` after that AI, to go toward the fixed monthly costs; null while `ai` is. */
  contribution: number | null;
}

export function breakdown(p: { cents: number; credits: number }, perCredit: number | null): Breakdown {
  const owner = ownerShare(p.cents);
  const toCosts = p.cents - owner;
  const ai = perCredit === null ? null : p.credits * perCredit;
  return { price: p.cents, owner, toCosts, ai, contribution: ai === null ? null : toCosts - ai };
}

/** How many purchases like this one a month it takes for their leftovers to pay the fixed costs; null when they never would. */
export const purchasesToCoverFixed = (contribution: number | null, fixedCents: number) => (contribution !== null && contribution > 0 ? Math.ceil(fixedCents / contribution) : null);

export interface MonthReport {
  revenue: number;
  owner: number;
  toCosts: number;
  /** All AI used in the period, by everyone (free credits cost real money too). */
  ai: number;
  fixed: number;
  /** What remains after the owner's 20%, the AI and the fixed costs. Negative means the 80% did not cover them. */
  left: number;
  covered: boolean;
}

export function monthReport(opts: { purchases: readonly { cents: number }[]; aiCostUsd: number; runningCosts: readonly { cents: number }[] }): MonthReport {
  const revenue = opts.purchases.reduce((a, p) => a + p.cents, 0);
  const owner = opts.purchases.reduce((a, p) => a + ownerShare(p.cents), 0);
  const ai = opts.aiCostUsd * 100;
  const fixed = opts.runningCosts.reduce((a, c) => a + c.cents, 0);
  const left = revenue - owner - ai - fixed;
  return { revenue, owner, toCosts: revenue - owner, ai, fixed, left, covered: left >= 0 };
}

/** "$1,234.50", with a minus sign for a loss. */
export const money = (cents: number) => `${cents < 0 ? "-" : ""}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** For tiny amounts such as one credit's AI cost: "$0.0021". */
export const moneyFine = (cents: number) => `$${(cents / 100).toFixed(4)}`;
