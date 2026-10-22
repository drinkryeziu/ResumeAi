import { describe, expect, it } from "vitest";
import { allOpen, initialOpen, noneOpen, setAllSections, toggleSection } from "@/components/features/profile/section-state";

const ids = ["summary", "experience", "skills", "delete"];

describe("profile sections open and closed", () => {
  it("opens only the first section when the page loads", () => {
    expect([...initialOpen(ids)]).toEqual(["summary"]);
    expect([...initialOpen([])]).toEqual([]);
  });

  it("opens and closes one section without touching the others", () => {
    const open = toggleSection(initialOpen(ids), "skills");
    expect([...open].sort()).toEqual(["skills", "summary"]);
    expect([...toggleSection(open, "summary")]).toEqual(["skills"]);
  });

  it("expands and collapses everything, and sections can still be changed after", () => {
    const all = setAllSections(ids, true);
    expect(allOpen(all, ids)).toBe(true);
    const none = setAllSections(ids, false);
    expect(noneOpen(none, ids)).toBe(true);
    expect(allOpen(toggleSection(all, "delete"), ids)).toBe(false);
    expect(noneOpen(toggleSection(none, "delete"), ids)).toBe(false);
  });

  it("never reports 'all open' for a page with no sections", () => {
    expect(allOpen(new Set(), [])).toBe(false);
  });
});
