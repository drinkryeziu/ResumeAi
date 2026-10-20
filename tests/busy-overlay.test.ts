import { describe, expect, it } from "vitest";
import { formatElapsed } from "@/components/ui/BusyOverlay";

describe("formatElapsed", () => {
  it("counts as minutes:seconds", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(9.9)).toBe("0:09");
    expect(formatElapsed(75)).toBe("1:15");
    expect(formatElapsed(-3)).toBe("0:00");
  });
});
