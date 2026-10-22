import { describe, expect, it } from "vitest";
import { TEST_PROFILE } from "./fixtures";
import { factAnswerProblem, factEdits, factsToInput, FACT_ANSWER_MISSING } from "@/server/domain/fact-answers";
import { toProfileInput, toProfileSnapshot } from "@/server/domain/profile-mapping";
import { ProfileInputSchema } from "@/server/domain/profile-schema";

const facts = [
  { id: "fact_1", topic: "WCAG", question: "Do you have WCAG experience?", answer: "Audited 40 pages", status: "APPROVED" as const },
  { id: "fact_2", topic: "Python", question: "Do you use Python?", answer: null, status: "DECLINED" as const },
];

describe("Your answers in the profile editor", () => {
  it("fills the editor with every saved answer, with its topic and question for labels", () => {
    const input = toProfileInput({ ...TEST_PROFILE, approvedFacts: facts }, "a@example.com", "");
    expect(input.answers).toEqual([
      { id: "fact_1", status: "APPROVED", answer: "Audited 40 pages", topic: "WCAG", question: "Do you have WCAG experience?" },
      { id: "fact_2", status: "DECLINED", answer: "", topic: "Python", question: "Do you use Python?" },
    ]);
    expect(factsToInput(undefined)).toEqual([]);
  });

  it("is accepted by the profile schema and never changes the saved answers through the profile snapshot", () => {
    const input = toProfileInput({ ...TEST_PROFILE, approvedFacts: facts }, "a@example.com", "");
    const parsed = ProfileInputSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(toProfileSnapshot("p1", parsed.data!, facts).approvedFacts).toEqual(facts);
  });

  it("asks for the person's own sentence when an answer is Yes", () => {
    expect(factAnswerProblem([{ id: "fact_1", status: "APPROVED", answer: "   " }])).toEqual({ id: "fact_1", message: FACT_ANSWER_MISSING });
    expect(factAnswerProblem([{ id: "fact_1", status: "APPROVED", answer: "Audited pages" }, { id: "fact_2", status: "DECLINED", answer: "" }])).toBeNull();
    expect(factAnswerProblem(undefined)).toBeNull();
  });

  it("saves a trimmed sentence for Yes and no text for No", () => {
    expect(
      factEdits([
        { id: "fact_1", status: "APPROVED", answer: "  Audited pages  " },
        { id: "fact_2", status: "DECLINED", answer: "left over text" },
      ]),
    ).toEqual([
      { id: "fact_1", status: "APPROVED", answer: "Audited pages" },
      { id: "fact_2", status: "DECLINED", answer: null },
    ]);
  });

  it("limits an answer to 600 characters, like the match questions", () => {
    const row = (answer: string) => ({ ...toProfileInput(TEST_PROFILE, "a@example.com", ""), answers: [{ id: "fact_1", status: "APPROVED" as const, answer }] });
    expect(ProfileInputSchema.safeParse(row("x".repeat(600))).success).toBe(true);
    expect(ProfileInputSchema.safeParse(row("x".repeat(601))).success).toBe(false);
  });
});

describe("Your answers never hold up saving the rest of the profile", () => {
  const withAnswers = (answers: NonNullable<ReturnType<typeof toProfileInput>["answers"]>) => ({ ...toProfileInput(TEST_PROFILE, "a@example.com", ""), answers });

  it("accepts answers whose topic and question are long, and ids of any shape", async () => {
    const long = "Experience with a very long requirement copied from a job posting. ".repeat(20);
    const input = withAnswers([{ id: "fact_9f8e7d6c5b4a", status: "APPROVED", answer: "Did it", topic: long, question: long }]);
    expect(ProfileInputSchema.safeParse(input).success).toBe(true);
    const { profileProgress } = await import("@/components/features/profile/profile-progress");
    expect(profileProgress(input).issues).toEqual([]);
  });

  it("reports no profile issue for an answer row, even a bad one (the editor checks the Yes sentence itself)", async () => {
    const { profileProgress } = await import("@/components/features/profile/profile-progress");
    const input = withAnswers([{ id: "", status: "APPROVED", answer: "x".repeat(700) }]);
    expect(profileProgress(input).issues).toEqual([]);
  });
});
