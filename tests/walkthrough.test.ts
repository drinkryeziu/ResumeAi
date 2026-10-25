import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { firstStepOf, LINE_STARTS_MS, SCENES, sceneProgress, shownLines, STEPS, stepAt, TOTAL_MS, TOUR_AUDIO, tourLength } from "@/lib/walkthrough";

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

  it("follows the recording: one start time per line, in order, inside the recording", () => {
    // If this fails, a line was added, removed or reworded: record the conversation again and find the start times again.
    expect(LINE_STARTS_MS).toHaveLength(STEPS.length);
    expect(LINE_STARTS_MS[0]).toBe(0);
    for (let n = 1; n < LINE_STARTS_MS.length; n++) expect(LINE_STARTS_MS[n]!).toBeGreaterThan(LINE_STARTS_MS[n - 1]!);
    expect(LINE_STARTS_MS.at(-1)!).toBeLessThan(TOUR_AUDIO.durationMs);
    expect(existsSync(`public${TOUR_AUDIO.src}`)).toBe(true);
  });

  it("lays the lines end to end on the recording's timeline", () => {
    expect(STEPS[0]!.start).toBe(0);
    for (let i = 1; i < STEPS.length; i++) expect(STEPS[i]!.start).toBe(STEPS[i - 1]!.start + STEPS[i - 1]!.ms);
    expect(TOTAL_MS).toBe(STEPS.at(-1)!.start + STEPS.at(-1)!.ms);
    expect(TOTAL_MS).toBeGreaterThan(60_000); // long enough to read
    expect(TOTAL_MS).toBeLessThan(150_000); // short enough to finish
    expect(tourLength()).toMatch(/^\d min( \d+ s)?$/);
  });

  it("knows which line is being spoken at any moment of the recording", () => {
    expect(stepAt(0)).toBe(0);
    expect(stepAt(LINE_STARTS_MS[5]! - 1)).toBe(4);
    expect(stepAt(LINE_STARTS_MS[5]!)).toBe(5);
    expect(stepAt(TOTAL_MS)).toBe(STEPS.length - 1);
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
