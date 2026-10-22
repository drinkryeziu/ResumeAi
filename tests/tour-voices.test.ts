import { describe, expect, it } from "vitest";
import { pickVoices, score } from "@/lib/tour-voices";

const v = (name: string, lang = "en-US") => ({ name, lang });

describe("choosing voices for the tour", () => {
  it("prefers natural, neural and premium voices to plain ones", () => {
    expect(score(v("Microsoft Aria Online (Natural) - English (United States)"))).toBeGreaterThan(score(v("Samantha")));
    expect(score(v("Ava (Premium)"))).toBeGreaterThan(score(v("Victoria")));
  });

  it("ignores other languages and avoids novelty voices", () => {
    expect(score(v("Amelie", "fr-FR"))).toBeLessThan(0);
    expect(score(v("Zarvox"))).toBeLessThan(score(v("Samantha")));
    const pick = pickVoices([v("Zarvox"), v("Bad News"), v("Amelie", "fr-FR")]);
    expect(pick.asks).toBeUndefined();
  });

  it("gives the person asking a woman's voice and the guide a man's when both exist, the best of each", () => {
    const pick = pickVoices([v("Daniel", "en-GB"), v("Samantha"), v("Ava (Premium)"), v("Alex"), v("Zarvox")]);
    expect(pick.asks?.name).toBe("Ava (Premium)");
    expect(pick.explains?.name).toBe("Alex");
    expect(pick.distinct).toBe(true);
  });

  it("falls back to two different voices, then to one voice, then to none", () => {
    const two = pickVoices([v("Google US English"), v("Some Voice")]);
    expect(two.asks?.name).not.toBe(two.explains?.name);
    expect(two.distinct).toBe(true);
    const one = pickVoices([v("Samantha")]);
    expect(one.asks?.name).toBe("Samantha");
    expect(one.explains?.name).toBe("Samantha");
    expect(one.distinct).toBe(false);
    expect(pickVoices([])).toEqual({ asks: undefined, explains: undefined, distinct: false });
  });
});
