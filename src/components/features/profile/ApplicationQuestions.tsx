"use client";

import { useId } from "react";
import { Field, Input, Select } from "@/components/ui/Field";
import { ANSWER_FIELDS, type AnswerKey, type ApplicationAnswers } from "@/server/domain/application-answers";

function Question({ k, value, onChange }: { k: AnswerKey; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const f = ANSWER_FIELDS[k];
  const hint = "hint" in f ? f.hint : undefined;
  return (
    <Field label={f.label} htmlFor={id} hint={hint}>
      {"options" in f ? (
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Not answered</option>
          {f.options.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      ) : (
        <Input id={id} value={value} maxLength={f.maxLength} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

/**
 * The questions employers usually ask on application forms, answered once. All optional. Kept private: they are never part of a
 * resume or cover letter and never sent to the AI; they are here so they can be copied into forms.
 */
export function ApplicationQuestions({ value, onChange }: { value: ApplicationAnswers; onChange: (next: ApplicationAnswers) => void }) {
  const ask = (k: AnswerKey) => <Question k={k} value={value[k] ?? ""} onChange={(v) => onChange({ ...value, [k]: v })} />;
  return (
    <div className="flex flex-col gap-ds-5">
      <p className="text-body-sm rounded-md bg-sky-50 p-ds-3">
        Every question is optional. Your answers are private: they never appear in your resume or cover letter and are never sent to the AI. They&apos;re here so you can copy them into the application forms you fill in.
      </p>

      <fieldset className="flex flex-col gap-ds-3">
        <legend className="text-heading-feature mb-ds-2">Work eligibility</legend>
        <div className="grid gap-ds-4 md:grid-cols-2">
          {ask("authorizedToWork")}
          {ask("needsSponsorship")}
          {ask("authorizationNote")}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-ds-3">
        <legend className="text-heading-feature mb-ds-2">Availability and preferences</legend>
        <div className="grid gap-ds-4 md:grid-cols-2">
          {ask("relocate")}
          {ask("workStyle")}
          {ask("noticePeriod")}
          {ask("salaryExpectation")}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-ds-3">
        <legend className="text-heading-feature mb-ds-1">Equal opportunity (voluntary)</legend>
        <p className="text-caption mb-ds-2">Some employers ask these. Answering is your choice, and “Prefer not to say” is always fine.</p>
        <div className="grid gap-ds-4 md:grid-cols-2">
          {ask("pronouns")}
          {ask("gender")}
          {value.gender === "self-describe" && ask("genderSelf")}
          {ask("race")}
          {ask("veteran")}
          {ask("disability")}
        </div>
      </fieldset>
    </div>
  );
}
