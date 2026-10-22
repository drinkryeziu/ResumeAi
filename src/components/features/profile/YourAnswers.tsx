"use client";

import { useId } from "react";
import { errorProps, Field, Textarea } from "@/components/ui/Field";
import { FACT_ANSWER_MAX, FACT_ANSWER_MISSING, type FactAnswerInput } from "@/server/domain/fact-answers";

function Row({ row, onChange, showError }: { row: FactAnswerInput; onChange: (patch: Partial<FactAnswerInput>) => void; showError: boolean }) {
  const id = useId();
  const yes = row.status === "APPROVED";
  const error = showError && yes && !row.answer?.trim() ? FACT_ANSWER_MISSING : undefined;
  const choice = (value: FactAnswerInput["status"], label: string) => (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={`${id}-status`}
        value={value}
        checked={row.status === value}
        onChange={() => onChange({ status: value })}
        className="peer sr-only"
      />
      <span className="inline-block rounded-pill bg-white px-ds-4 py-1.5 text-body-sm peer-checked:bg-blue-600 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-blue-600">
        {label}
      </span>
    </label>
  );
  return (
    <fieldset id={`answer-${row.id}`} data-field={`answers.${row.id}`} className="flex flex-col gap-ds-3 rounded-md bg-gray-100 p-ds-3">
      <legend className="sr-only">{row.topic}</legend>
      <div className="flex flex-col gap-1">
        <span className="text-label-bold">{row.topic}</span>
        {row.question && <span className="text-caption">{row.question}</span>}
      </div>
      <div role="radiogroup" aria-label={`Do you have experience with ${row.topic}?`} className="flex gap-ds-2">
        {choice("APPROVED", "Yes")}
        {choice("DECLINED", "No")}
      </div>
      {yes && (
        <Field
          label="Your experience, in your own words"
          htmlFor={`${id}-text`}
          required
          error={error}
          hint="Used in tailored resumes. Only write what is true."
        >
          <Textarea
            id={`${id}-text`}
            value={row.answer ?? ""}
            maxLength={FACT_ANSWER_MAX}
            aria-required="true"
            onChange={(e) => onChange({ answer: e.target.value })}
            className="min-h-24! bg-white"
            {...errorProps(`${id}-text`, error)}
          />
        </Field>
      )}
    </fieldset>
  );
}

/** The answers given to job-match questions, editable: a Yes carries the person's own sentence, a No is remembered so it is never claimed. */
export function YourAnswers({ value, onChange, showErrors }: { value: FactAnswerInput[]; onChange: (next: FactAnswerInput[]) => void; showErrors: boolean }) {
  return (
    <div className="flex flex-col gap-ds-3">
      {value.map((row) => (
        <Row key={row.id} row={row} showError={showErrors} onChange={(patch) => onChange(value.map((r) => (r.id === row.id ? { ...r, ...patch } : r)))} />
      ))}
    </div>
  );
}
