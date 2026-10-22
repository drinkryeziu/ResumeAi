/**
 * Search and sort for the admin people table. Pure, so the rules are tested; the table only wires them to the page.
 * Rows carry dates as ISO text because they cross from the server page to the browser.
 */
export interface PersonRow {
  id: string;
  name: string;
  email: string;
  hasProfile: boolean;
  applications: number;
  applied: number;
  averageScore: number | null;
  lastActiveAt: string;
  active: boolean;
}

export type SortKey = "name" | "applications" | "applied" | "averageScore" | "lastActiveAt" | "status";
export type SortDir = "asc" | "desc";

export const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  applications: "Applications created",
  applied: "Applied",
  averageScore: "Average score",
  lastActiveAt: "Last active",
  status: "Status",
};

/** The way a column opens the first time it is chosen: text from A, numbers and dates from the largest, active people first. */
export const FIRST_DIR: Record<SortKey, SortDir> = { name: "asc", applications: "desc", applied: "desc", averageScore: "desc", lastActiveAt: "desc", status: "desc" };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** People whose name (or email) contains every word typed, ignoring capitals and accents. An empty search keeps everyone. */
export function filterPeople<T extends Pick<PersonRow, "name" | "email">>(rows: readonly T[], query: string): T[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...rows];
  return rows.filter((r) => {
    const hay = `${norm(r.name)} ${norm(r.email)}`;
    return words.every((w) => hay.includes(w));
  });
}

/** Sorted copy. People with no score always go last for the score column; ties fall back to name, so the order never jumps around. */
export function sortPeople<T extends PersonRow>(rows: readonly T[], key: SortKey, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  const value = (r: T): number | string | null => {
    switch (key) {
      case "name":
        return r.name;
      case "lastActiveAt":
        return +new Date(r.lastActiveAt);
      case "status":
        return r.active ? 1 : 0;
      default:
        return r[key];
    }
  };
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === null && y === null) return byName(a, b);
    if (x === null) return 1; // missing values last, whichever way it is sorted
    if (y === null) return -1;
    const c = typeof x === "string" ? x.localeCompare(y as string, "en", { sensitivity: "base" }) : (x as number) - (y as number);
    return c !== 0 ? sign * c : byName(a, b);
  });
}
