/** Month-and-year values are stored as "YYYY-MM" (what the profile schema expects) and shown as "Mar 2021". */

const NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const MIN_YEAR = 1950;
export const MAX_YEAR = 2100;

const pad = (n: number) => String(n).padStart(2, "0");
const valid = (y: number, m: number) => m >= 1 && m <= 12 && y >= MIN_YEAR && y <= MAX_YEAR;

/**
 * Reads what a person types: "Mar 2021", "March 2021", "mar, 2021", "03/2021", "3-2021", "2021-03", "2021/3".
 * Returns "YYYY-MM", or null when it isn't a real month and year.
 */
export function parseMonthYear(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ");
  if (!t) return null;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^([a-z]{3,9})[\s\-/]*(\d{4})$/))) {
    const idx = NAMES.findIndex((n) => m![1]!.startsWith(n));
    // "mar" and "march" are fine; "marx" is not
    const full = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][idx];
    if (idx >= 0 && (m[1]!.length === 3 || full?.startsWith(m[1]!) || (idx === 8 && m[1] === "sept")) && valid(+m[2]!, idx + 1)) return `${m[2]}-${pad(idx + 1)}`;
    return null;
  }
  if ((m = t.match(/^(\d{1,2})[\s\-/](\d{4})$/))) return valid(+m[2]!, +m[1]!) ? `${m[2]}-${pad(+m[1]!)}` : null;
  if ((m = t.match(/^(\d{4})[\s\-/](\d{1,2})$/))) return valid(+m[1]!, +m[2]!) ? `${m[1]}-${pad(+m[2]!)}` : null;
  return null;
}

/** "2021-03" → "Mar 2021"; anything else → "". */
export function monthLabel(value: string | null | undefined): string {
  const m = (value ?? "").match(/^(\d{4})-(\d{2})$/);
  return m && valid(+m[1]!, +m[2]!) ? `${MONTH_LABELS[+m[2]! - 1]} ${m[1]}` : "";
}
