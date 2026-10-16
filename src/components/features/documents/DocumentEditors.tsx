"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { Info } from "lucide-react";
import { saveCoverLetterEdits, saveResumeEdits, type ActionState } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { formatMonthYear } from "@/lib/format";
import type { CoverLetterDocument, ResumeDocument } from "@/server/documents/model";

function SaveBar({ state, cancelHref }: { state: ActionState; cancelHref: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-0 flex flex-wrap items-center gap-ds-4 border-t border-gray-100 bg-white pt-ds-4">
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save as new version"}
      </Button>
      <Link href={cancelHref} className="text-body-sm text-blue-700 underline">
        Cancel
      </Link>
      {state?.error && (
        <p role="alert" className="text-body-sm text-danger">
          {state.error}
        </p>
      )}
    </div>
  );
}

/**
 * Wording is editable here. Employer, title, dates and school are facts from the profile —
 * they're shown read-only, with a link to change them in the profile, so every document stays consistent.
 */
export function ResumeEditor({ doc, target, cancelHref }: { doc: ResumeDocument; target: string; cancelHref: string }) {
  const [state, action] = useActionState(saveResumeEdits, undefined);
  const uid = useId();
  return (
    <form action={action} className="flex flex-col gap-ds-4 rounded-md bg-white p-ds-5 shadow-card">
      <input type="hidden" name="jobId" value={target} />
      <p className="flex gap-ds-2 rounded-md bg-sky-50 p-ds-3 text-body-sm">
        <Info size={18} className="shrink-0 text-blue-600" aria-hidden="true" />
        <span>
          Edit the wording below. To change an employer, job title, date or school,{" "}
          <Link href="/profile/edit" className="text-blue-700 underline">
            update your profile
          </Link>
          .
        </span>
      </p>
      <Field label="Headline" htmlFor={`${uid}-h`} required>
        <Input id={`${uid}-h`} name="headline" defaultValue={doc.header.headline} required />
      </Field>
      <Field label="Summary" htmlFor={`${uid}-s`}>
        <Textarea id={`${uid}-s`} name="summary" defaultValue={doc.summary} className="min-h-28" />
      </Field>
      <fieldset className="flex flex-col gap-ds-4">
        <legend className="text-label-bold mb-ds-2">Experience</legend>
        {doc.experience.map((e) => (
          <div key={e.sourceId} className="flex flex-col gap-ds-2 rounded-md bg-gray-100 p-ds-3">
            <input type="hidden" name="expId" value={e.sourceId} />
            <p className="text-label-bold">
              {e.title}, {e.company}{" "}
              <span className="text-caption font-normal">
                · {formatMonthYear(e.startDate)} – {formatMonthYear(e.endDate ?? undefined)}
              </span>
            </p>
            <Field label="Bullets (one per line)" htmlFor={`${uid}-${e.sourceId}`}>
              <Textarea id={`${uid}-${e.sourceId}`} name={`bullets:${e.sourceId}`} defaultValue={e.bullets.join("\n")} className="min-h-32 bg-white" />
            </Field>
          </div>
        ))}
      </fieldset>
      <Field label="Skills (separate with commas)" htmlFor={`${uid}-sk`}>
        <Textarea id={`${uid}-sk`} name="skills" defaultValue={doc.skills.join(", ")} className="min-h-20" />
      </Field>
      {doc.projects.map((p) => (
        <div key={p.sourceId}>
          <input type="hidden" name="projId" value={p.sourceId} />
          <Field label={`Project: ${p.name}`} htmlFor={`${uid}-p-${p.sourceId}`}>
            <Textarea id={`${uid}-p-${p.sourceId}`} name={`project:${p.sourceId}`} defaultValue={p.description} className="min-h-20" />
          </Field>
        </div>
      ))}
      <SaveBar state={state} cancelHref={cancelHref} />
    </form>
  );
}

export function CoverLetterEditor({ doc, target, cancelHref }: { doc: CoverLetterDocument; target: string; cancelHref: string }) {
  const [state, action] = useActionState(saveCoverLetterEdits, undefined);
  const uid = useId();
  return (
    <form action={action} className="flex flex-col gap-ds-4 rounded-md bg-white p-ds-5 shadow-card">
      <input type="hidden" name="jobId" value={target} />
      <Field label="Greeting" htmlFor={`${uid}-g`} required>
        <Input id={`${uid}-g`} name="greeting" defaultValue={doc.greeting} required />
      </Field>
      <Field label="Letter" htmlFor={`${uid}-b`} required hint="Leave a blank line between paragraphs.">
        <Textarea id={`${uid}-b`} name="body" defaultValue={doc.paragraphs.join("\n\n")} className="min-h-96 leading-relaxed" required />
      </Field>
      <Field label="Closing" htmlFor={`${uid}-c`} required>
        <Input id={`${uid}-c`} name="closing" defaultValue={doc.closing} required />
      </Field>
      <SaveBar state={state} cancelHref={cancelHref} />
    </form>
  );
}
