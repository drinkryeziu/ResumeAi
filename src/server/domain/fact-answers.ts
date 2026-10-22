import type { ApprovedFactItem } from "./profile";

/**
 * "Your answers": what the candidate told us when a job match asked "do you have this experience?". A Yes carries the
 * candidate's own sentence and may be used in tailored resumes; a No is remembered so it is never claimed. They are
 * shown on the profile and can be corrected in the profile editor (the topic itself stays: it is how a question is matched).
 */
export interface FactAnswerInput {
  id: string;
  status: "APPROVED" | "DECLINED";
  answer?: string;
  /** For display in the editor only; never read back when saving. */
  topic?: string;
  question?: string;
}

export const FACT_ANSWER_MAX = 600;
export const FACT_ANSWER_MISSING = "Add a sentence about your experience so we can use it accurately.";

/** The editor's rows, one per saved answer. */
export const factsToInput = (facts: readonly ApprovedFactItem[] | undefined): FactAnswerInput[] =>
  (facts ?? []).map((f) => ({ id: f.id, status: f.status, answer: f.answer ?? "", topic: f.topic, question: f.question }));

/** The first problem in the submitted rows, or null: a Yes needs the person's own sentence. */
export function factAnswerProblem(rows: readonly FactAnswerInput[] | undefined): { id: string; message: string } | null {
  const bad = (rows ?? []).find((r) => r.status === "APPROVED" && !r.answer?.trim());
  return bad ? { id: bad.id, message: FACT_ANSWER_MISSING } : null;
}

/** What is saved for the rows: a No never keeps text; a Yes keeps the trimmed sentence. */
export const factEdits = (rows: readonly FactAnswerInput[] | undefined) =>
  (rows ?? []).map((r) => ({ id: r.id, status: r.status, answer: r.status === "APPROVED" ? (r.answer?.trim() ?? "") : null }));
