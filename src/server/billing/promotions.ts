/**
 * Credit promotions: every user gets `credits` once, the next time they open the app, while `active` is true.
 * Existing accounts and new sign-ups are covered the same way. To end a promotion set `active: false` (people who already
 * received it keep it; nobody gets it twice, because the grant is keyed by promotion id and user id). A new promotion
 * needs a new `id`.
 */
export interface Promotion {
  id: string;
  credits: number;
  active: boolean;
  /** Shown to the user in their credit history. */
  label: string;
}

export const PROMOTIONS: readonly Promotion[] = [{ id: "launch-150", credits: 150, active: true, label: "Launch credits" }];
