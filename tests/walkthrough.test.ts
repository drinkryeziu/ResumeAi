import { describe, expect, it } from "vitest";
import { firstStepOf, lineMs, SCENES, sceneProgress, shownLines, STEPS, TOTAL_MS, tourLength } from "@/lib/walkthrough";

describe("the first-page tour", () => {
  it("is a conversation: every scene opens with a question and is answered by the guide", () => {
    for (const s of SCENES) {
      expect(s.lines[0]!.speaker).toBe("asks");
      expect(s.lines[1]!.speaker).toBe("explains");
      expect(s.lines.slice(1).every((l) => l.speaker === "explains")).toBe(true);
    }
  });

  it("opens with what the app is and how to start, and tells people to sign up first", () => {
    expect(SCENES[0]!.lines[0]!.text).toMatch(/what is this app about/i);
    expect(SCENES[1]!.lines[0]!.text).toMatch(/how do I use it/i);
    expect(SCENES[1]!.lines[1]!.text).toMatch(/sign up/i);
  });

  it("covers the whole journey, in order", () => {
    expect(SCENES.map((s) => s.id)).toEqual(["about", "signup", "profile", "career", "directions", "job", "match", "questions", "documents", "download"]);
  });

  it("sounds like talking: contractions, short questions, and nothing stiff", () => {
    const said = SCENES.flatMap((s) => s.lines.map((l) => l.text));
    expect(said.filter((t) => /\b(I'm|it's|that's|don't|you'll|won't|we'll|I've|company's|doesn't)\b/i.test(t)).length).toBeGreaterThanOrEqual(6);
    expect(said.filter((t) => t.length < 60).length).toBeGreaterThanOrEqual(8); // the questions are short, like a person's
  });

  it("uses plain words: no jargon and no emoji", () => {
    const text = SCENES.flatMap((s) => [s.title, ...s.lines.map((l) => l.text)]).join(" ");
    expect(text).not.toMatch(/\b(LLM|tokens?|agent|prompt|AI model)\b/i);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("promises only what the product does", () => {
    const text = SCENES.flatMap((s) => s.lines.map((l) => l.text)).join(" ");
    expect(text).toMatch(/never apply for you/);
    expect(text).toMatch(/never make anything up/);
    expect(text).not.toMatch(/guarantee|interview|hired/i);
  });

  it("times each line by its length, with a floor", () => {
    expect(lineMs("Hi")).toBe(2600);
    expect(lineMs("x".repeat(100))).toBe(100 * 62 + 900);
  });

  it("lays the lines end to end on one timeline", () => {
    expect(STEPS[0]!.start).toBe(0);
    for (let i = 1; i < STEPS.length; i++) expect(STEPS[i]!.start).toBe(STEPS[i - 1]!.start + STEPS[i - 1]!.ms);
    expect(TOTAL_MS).toBe(STEPS.at(-1)!.start + STEPS.at(-1)!.ms);
    expect(TOTAL_MS).toBeGreaterThan(60_000); // long enough to read
    expect(TOTAL_MS).toBeLessThan(150_000); // short enough to finish
    expect(tourLength()).toMatch(/^\d min( \d+ s)?$/);
  });

  it("finds a scene's first line and the conversation shown so far", () => {
    expect(firstStepOf(0)).toBe(0);
    expect(STEPS[firstStepOf(3)]).toMatchObject({ scene: 3, line: 0 });
    const second = firstStepOf(0) + 1;
    expect(shownLines(0).map((l) => l.speaker)).toEqual(["asks"]);
    expect(shownLines(second).map((l) => l.speaker)).toEqual(["asks", "explains"]);
    expect(shownLines(STEPS.length - 1).map((l) => l.line)).toEqual([0, 1, 2]);
  });

  it("fills a scene's progress bar from the lines played and the time into the current one", () => {
    const i = firstStepOf(4);
    expect(sceneProgress(3, i, 0)).toBe(1);
    expect(sceneProgress(5, i, 0)).toBe(0);
    expect(sceneProgress(4, i, 0)).toBe(0);
    const half = sceneProgress(4, i, STEPS[i]!.ms);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
    expect(sceneProgress(4, i + 1, STEPS[i + 1]!.ms)).toBe(1);
  });
});
