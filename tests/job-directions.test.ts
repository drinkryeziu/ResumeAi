import { describe, expect, it } from "vitest";
import { jobDirections } from "@/server/ai/directions";

const prof = (...rows: Array<[string, number]>) => ({ byProfession: rows.map(([name, years]) => ({ name, years })) });

describe("jobs to look for", () => {
  it("shares the experience out by profession, adding up to exactly 100", () => {
    const d = jobDirections(prof(["UX design", 7.6], ["Graphic design", 2.4]));
    expect(d.map((x) => [x.name, x.percent])).toEqual([
      ["UX design", 76],
      ["Graphic design", 24],
    ]);
    expect(d.map((x) => x.level)).toEqual(["best", "good"]);
    const odd = jobDirections(prof(["A", 1], ["B", 1], ["C", 1]));
    expect(odd.reduce((a, b) => a + b.percent, 0)).toBe(100);
  });

  it("puts the biggest first and calls a thin slice a long shot", () => {
    const d = jobDirections(prof(["Support", 1], ["Product design", 8], ["Marketing", 0.5]));
    expect(d[0]).toMatchObject({ name: "Product design", level: "best" });
    expect(d.at(-1)).toMatchObject({ name: "Marketing", level: "small" });
  });

  it("is one hundred percent for a single profession and nothing without work history", () => {
    expect(jobDirections(prof(["Nursing", 4]))).toEqual([{ name: "Nursing", years: 4, percent: 100, level: "best" }]);
    expect(jobDirections(prof())).toEqual([]);
    expect(jobDirections(undefined)).toEqual([]);
    expect(jobDirections(prof(["Nothing", 0]))).toEqual([]);
  });

  it("shows at most five", () => {
    expect(jobDirections(prof(...["a", "b", "c", "d", "e", "f", "g"].map((n, i): [string, number] => [n, 7 - i])))).toHaveLength(5);
  });
});
