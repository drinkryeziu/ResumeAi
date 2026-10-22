import { describe, expect, it } from "vitest";
import { filterPeople, sortPeople, type PersonRow } from "@/server/admin/people-table";

const p = (id: string, name: string, over: Partial<PersonRow> = {}): PersonRow => ({
  id,
  name,
  email: `${id}@example.com`,
  hasProfile: true,
  applications: 0,
  applied: 0,
  averageScore: null,
  lastActiveAt: "2026-10-01T00:00:00Z",
  active: true,
  ...over,
});
const rows = [
  p("a", "Zoë Zimmer", { applications: 2, applied: 1, averageScore: 70, lastActiveAt: "2026-10-20T00:00:00Z" }),
  p("b", "adam Ames", { applications: 5, applied: 0, averageScore: 90, lastActiveAt: "2026-09-01T00:00:00Z", active: false }),
  p("c", "Mia Müller", { applications: 5, applied: 3, averageScore: null, lastActiveAt: "2026-10-22T00:00:00Z" }),
];
const ids = (r: PersonRow[]) => r.map((x) => x.id).join("");

describe("people table search", () => {
  it("matches names ignoring capitals and accents, every word typed, and keeps everyone for an empty search", () => {
    expect(ids(filterPeople(rows, "zoe"))).toBe("a");
    expect(ids(filterPeople(rows, "MULLER"))).toBe("c");
    expect(ids(filterPeople(rows, "mia mü"))).toBe("c");
    expect(ids(filterPeople(rows, "ames adam"))).toBe("b");
    expect(ids(filterPeople(rows, "  "))).toBe("abc");
    expect(filterPeople(rows, "nobody")).toEqual([]);
  });

  it("also finds a person by email", () => {
    expect(ids(filterPeople(rows, "b@example"))).toBe("b");
  });
});

describe("people table sorting", () => {
  it("sorts names A to Z without regard to capitals, and back", () => {
    expect(ids(sortPeople(rows, "name", "asc"))).toBe("bca");
    expect(ids(sortPeople(rows, "name", "desc"))).toBe("acb");
  });

  it("sorts numbers and dates both ways, with name as the tie-break", () => {
    expect(ids(sortPeople(rows, "applications", "desc"))).toBe("bca");
    expect(ids(sortPeople(rows, "applications", "asc"))).toBe("abc");
    expect(ids(sortPeople(rows, "applied", "desc"))).toBe("cab");
    expect(ids(sortPeople(rows, "lastActiveAt", "desc"))).toBe("cab");
    expect(ids(sortPeople(rows, "lastActiveAt", "asc"))).toBe("bac");
  });

  it("puts people with no score last in either direction", () => {
    expect(ids(sortPeople(rows, "averageScore", "desc"))).toBe("bac");
    expect(ids(sortPeople(rows, "averageScore", "asc"))).toBe("abc");
  });

  it("sorts by status, active people first when descending, and does not change the list it was given", () => {
    const copy = [...rows];
    expect(ids(sortPeople(rows, "status", "desc"))).toBe("cab"); // active people, A to Z, then the inactive one
    expect(ids(sortPeople(rows, "status", "asc"))).toBe("bca");
    expect(rows).toEqual(copy);
  });
});
