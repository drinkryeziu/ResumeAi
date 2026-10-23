import type { CareerAnalysis } from "./experience";

/**
 * "Jobs to look for": where the person's experience is, read from the Master Resume's career analysis. It is arithmetic on the
 * dates, not a guess and not a prediction of being hired: each kind of work gets its share of the years the person has spent on
 * all the kinds of work together (the model only named which roles are which kind of work).
 */
export type DirectionLevel = "best" | "good" | "small";

export interface Direction {
  name: string;
  years: number;
  /** Share of the person's experience, whole numbers that add up to 100. */
  percent: number;
  level: DirectionLevel;
}

/** At or above this share a kind of work is where the experience is. */
export const BEST_FROM = 50;
/** Below this share it is a small part of the experience: a search there is a long shot. */
export const SMALL_BELOW = 15;
const MAX_ROWS = 5;

/** The shares, rounded so they add up to exactly 100 (largest remainder). */
function shares(years: number[]): number[] {
  const total = years.reduce((a, b) => a + b, 0);
  const exact = years.map((y) => (y / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]!++;
    left--;
  }
  return floors;
}

export function jobDirections(analysis: Pick<CareerAnalysis, "byProfession"> | null | undefined): Direction[] {
  const rows = (analysis?.byProfession ?? []).filter((p) => p.name.trim() && p.years > 0).sort((a, b) => b.years - a.years);
  if (rows.length === 0) return [];
  const percent = shares(rows.map((r) => r.years));
  const all = rows.map((r, i) => ({
    name: r.name.trim(),
    years: r.years,
    percent: percent[i]!,
    level: (percent[i]! >= BEST_FROM ? "best" : percent[i]! >= SMALL_BELOW ? "good" : "small") as DirectionLevel,
  }));
  return all.slice(0, MAX_ROWS);
}
