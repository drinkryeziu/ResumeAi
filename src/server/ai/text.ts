/** Small, dependency-free text helpers shared by scoring, the guard and mock workflows. */

const STOP = new Set(
  "a an and are as at be by for from has have in into is it its of on or our the their this to was we will with you your who what able across ability strong excellent experience experienced working work years year plus including include etc using use well".split(
    " ",
  ),
);

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokens = (s: string) => normalize(s).split(" ").filter((t) => t.length > 1 && !STOP.has(t));

/** Whole-term match, so "Java" does not match "JavaScript". */
export function containsTerm(haystack: string, term: string): boolean {
  const h = ` ${normalize(haystack)} `;
  const t = normalize(term);
  if (!t) return false;
  return h.includes(` ${t} `) || h.includes(` ${t}s `) || h.includes(` ${t}. `) || h.includes(` ${t}, `);
}

export function countTerm(haystack: string, term: string): number {
  const t = normalize(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!t) return 0;
  const re = new RegExp(`(^|[^a-z0-9])${t}(?=$|[^a-z0-9])`, "g");
  return (normalize(haystack).match(re) ?? []).length;
}

/**
 * Numbers that make a claim: percentages, money, multipliers and counts of 2+ digits.
 * Years (1900–2099) are excluded because dates are copied from the profile, not written by AI.
 */
export function claimNumbers(s: string): string[] {
  const found = s.match(/[$€£]?\d[\d,.]*\s?(%|k|m|x|\+)?/gi) ?? [];
  return found
    .map((n) => n.trim().toLowerCase().replace(/,/g, ""))
    .filter((n) => {
      const digits = n.replace(/[^0-9.]/g, "");
      if (!digits) return false;
      const v = Number(digits);
      if (/^(19|20)\d{2}$/.test(digits) && !/[%$€£kmx+]/.test(n)) return false;
      return /[%$€£kmx+]/.test(n) || v >= 10 || digits.includes(".");
    })
    .map((n) => n.replace(/[^0-9.%$€£kmx+]/g, ""));
}
