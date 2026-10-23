/**
 * The numbers Ask Drin quotes (what an action costs, what a plan gives), read from the price list itself on the server and handed
 * to the chat, so an answer can never disagree with what the buttons charge.
 */
export interface Facts {
  signupCredits: number;
  /** Extra credits every account gets right now from a launch offer, 0 when none is on. */
  launchCredits: number;
  tailorCredits: number;
  createCredits: number;
  fullApplicationCredits: number;
  matchCredits: number;
  atsCredits: number;
  coverEditCredits: number;
  coverRewriteCredits: number;
  improveCredits: number;
  plans: Array<{ name: string; price: string; credits: number; applications: number }>;
  packs: Array<{ name: string; price: string }>;
}
