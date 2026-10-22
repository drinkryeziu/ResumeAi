import { describe, expect, it } from "vitest";
import { guideFor, type CvProblem } from "@/lib/cv-problems";

const ALL: CvProblem[] = ["no_file", "too_short", "too_big", "empty", "unsupported", "scanned", "no_content", "unreadable", "ai_busy", "ai_off", "too_fast", "network"];

describe("CV upload problems", () => {
  it("explain every problem in plain words: a title, a reason, steps to try and a next action", () => {
    for (const p of ALL) {
      const g = guideFor(p);
      expect(g.title.length, p).toBeGreaterThan(5);
      expect(g.reason.length, p).toBeGreaterThan(10);
      expect(g.steps.length, p).toBeGreaterThanOrEqual(1);
      expect(g.nextLabel.length, p).toBeGreaterThan(1);
      const all = [g.title, g.reason, ...g.steps].join(" ");
      expect(all, p).not.toMatch(/\b(LLM|tokens?|agent|prompt|guard|schema|API)\b/i);
      expect(all, p).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("sends people the way that fixes it", () => {
    expect(guideFor("scanned").next).toBe("paste");
    expect(guideFor("too_big").next).toBe("paste");
    expect(guideFor("unsupported").next).toBe("choose");
    expect(guideFor("empty").next).toBe("choose");
    expect(guideFor("ai_busy").next).toBe("retry");
    expect(guideFor("ai_off").next).toBe("close");
  });

  it("says how big the file was, and always offers a way out that doesn't need the upload", () => {
    expect(guideFor("too_big", { sizeMb: 6.04 }).reason).toBe("Your file is 6.0 MB. The most we can read is 4 MB.");
    expect(guideFor("too_big").reason).toBe("The most we can read is 4 MB.");
    for (const p of ["too_big", "scanned", "unreadable", "no_content"] as CvProblem[]) {
      expect(guideFor(p).steps.join(" "), p).toMatch(/paste|by hand/i);
    }
  });
});
