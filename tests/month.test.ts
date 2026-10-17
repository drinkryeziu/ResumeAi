import { describe, expect, it } from "vitest";
import { monthLabel, parseMonthYear } from "@/lib/month";

describe("month and year input", () => {
  it.each([
    ["Mar 2021", "2021-03"],
    ["march 2021", "2021-03"],
    ["MAR, 2021", "2021-03"],
    ["Sept 2019", "2019-09"],
    ["03/2021", "2021-03"],
    ["3-2021", "2021-03"],
    ["2021-03", "2021-03"],
    ["2021/3", "2021-03"],
    ["  Dec   1999 ", "1999-12"],
  ])("reads %j as %s", (text, stored) => {
    expect(parseMonthYear(text)).toBe(stored);
  });

  it.each(["", "Mar", "2021", "Mar 21", "13/2021", "00/2021", "Marx 2021", "Mar 1800", "Mar 3000", "2021-13", "hello world"])("rejects %j", (text) => {
    expect(parseMonthYear(text)).toBeNull();
  });

  it("shows stored values as Mon YYYY and ignores anything else", () => {
    expect(monthLabel("2021-03")).toBe("Mar 2021");
    expect(monthLabel("1999-12")).toBe("Dec 1999");
    expect(monthLabel("")).toBe("");
    expect(monthLabel(undefined)).toBe("");
    expect(monthLabel("2021-13")).toBe("");
    expect(monthLabel("March")).toBe("");
  });

  it("round-trips what the profile schema stores", () => {
    for (const v of ["2018-01", "2021-12", "1975-06"]) expect(parseMonthYear(monthLabel(v))).toBe(v);
  });
});
