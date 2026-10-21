/**
 * The questions employers usually ask on an application form, kept with the profile so they are written once and copied when needed.
 * Every one is optional. They are private to the person: never part of a resume or cover letter, never sent to the AI.
 * The demographic ones (gender, race or ethnicity, veteran and disability status) are the "equal opportunity" questions some
 * countries' forms ask voluntarily; each has "Prefer not to say".
 */

export type Choice = readonly [value: string, label: string];

const YES_NO: readonly Choice[] = [
  ["yes", "Yes"],
  ["no", "No"],
];

export const ANSWER_FIELDS = {
  authorizedToWork: { label: "Are you legally authorized to work in the country you're applying in?", options: YES_NO },
  needsSponsorship: { label: "Will you now or in the future need visa sponsorship?", options: YES_NO },
  authorizationNote: { label: "Citizenship or visa status", hint: "For example “US citizen”, “EU citizen” or “H-1B”. Optional.", maxLength: 160 },
  relocate: {
    label: "Are you willing to relocate?",
    options: [
      ["yes", "Yes"],
      ["no", "No"],
      ["maybe", "Maybe, depending on the role"],
    ] as readonly Choice[],
  },
  workStyle: {
    label: "How do you want to work?",
    options: [
      ["remote", "Remote"],
      ["hybrid", "Hybrid"],
      ["onsite", "On-site"],
      ["any", "Open to any"],
    ] as readonly Choice[],
  },
  noticePeriod: { label: "Notice period or earliest start date", hint: "For example “2 weeks” or “1 March”.", maxLength: 80 },
  salaryExpectation: { label: "Salary expectation", hint: "For example “$95,000–$110,000”. Optional.", maxLength: 80 },
  pronouns: { label: "Pronouns", hint: "For example “she/her” or “they/them”.", maxLength: 40 },
  gender: {
    label: "Gender",
    options: [
      ["woman", "Woman"],
      ["man", "Man"],
      ["non-binary", "Non-binary"],
      ["self-describe", "I describe myself differently"],
      ["decline", "Prefer not to say"],
    ] as readonly Choice[],
  },
  genderSelf: { label: "How you describe your gender", maxLength: 60 },
  race: {
    label: "Race or ethnicity",
    options: [
      ["hispanic-latino", "Hispanic or Latino"],
      ["white", "White"],
      ["black", "Black or African American"],
      ["asian", "Asian"],
      ["pacific-islander", "Native Hawaiian or other Pacific Islander"],
      ["native-american", "American Indian or Alaska Native"],
      ["two-or-more", "Two or more races"],
      ["decline", "Prefer not to say"],
    ] as readonly Choice[],
  },
  veteran: {
    label: "Veteran status",
    options: [
      ["protected-veteran", "I am a protected veteran"],
      ["not-veteran", "I am not a veteran"],
      ["decline", "Prefer not to say"],
    ] as readonly Choice[],
  },
  disability: {
    label: "Disability status",
    options: [
      ["yes", "Yes, I have a disability"],
      ["no", "No, I don't have a disability"],
      ["decline", "Prefer not to say"],
    ] as readonly Choice[],
  },
} as const;

export type AnswerKey = keyof typeof ANSWER_FIELDS;
export const ANSWER_KEYS = Object.keys(ANSWER_FIELDS) as AnswerKey[];

/** What is stored: every field optional text; the value is one of the field's option values when it has options. */
export type ApplicationAnswers = Partial<Record<AnswerKey, string>>;

export const optionValues = (key: AnswerKey): string[] => {
  const f = ANSWER_FIELDS[key];
  return "options" in f ? f.options.map(([v]) => v) : [];
};

/** The words for a stored answer: an option's label, or the text as typed. */
export function answerLabel(key: AnswerKey, value: string): string {
  const f = ANSWER_FIELDS[key];
  return "options" in f ? (f.options.find(([v]) => v === value)?.[1] ?? value) : value;
}

/** Only the answers that were given, as stored. */
export function compactAnswers(a: ApplicationAnswers | undefined): ApplicationAnswers {
  return Object.fromEntries(ANSWER_KEYS.flatMap((k) => (a?.[k]?.trim() ? [[k, a[k]!.trim()]] : [])));
}

/** The answers that were given, in the order they are asked, with their questions, for showing and copying. */
export function givenAnswers(a: ApplicationAnswers | undefined): Array<{ key: AnswerKey; question: string; answer: string }> {
  const given = compactAnswers(a);
  return ANSWER_KEYS.flatMap((k) => {
    if (!given[k]) return [];
    if (k === "genderSelf") return []; // shown with gender
    const answer = k === "gender" && given.gender === "self-describe" && given.genderSelf ? given.genderSelf : answerLabel(k, given[k]!);
    return [{ key: k, question: ANSWER_FIELDS[k].label, answer }];
  });
}
