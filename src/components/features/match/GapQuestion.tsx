"use client";

import { useActionState, useState } from "react";
import { HelpCircle } from "lucide-react";
import { answerQuestion } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { FormMessage } from "@/components/features/job-flow/ActionForm";

/**
 * "Do you have experience with X?" — YES asks for the user's own words (stored as an approved fact),
 * NO is remembered so it's never claimed or asked again, SKIP just moves on.
 */
export function GapQuestion({ jobId, topic, question, answered }: { jobId: string; topic: string; question: string; answered?: "yes" | "no" }) {
  const [choice, setChoice] = useState<"yes" | "no" | "skip" | null>(answered ?? null);
  const [state, action, pending] = useActionState(answerQuestion, undefined);
  const done = Boolean(state?.ok) || Boolean(answered);

  if (choice === "skip") return null;

  return (
    <li className="rounded-md bg-sky-50 p-ds-4">
      <div className="flex gap-ds-3">
        <HelpCircle size={20} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
        <div className="flex flex-1 flex-col gap-ds-3">
          <p className="text-body">{question}</p>
          {done ? (
            <p className="text-body-sm text-success" role="status">
              {state?.ok ?? (answered === "yes" ? "You said yes — we'll use your answer when we create your application." : "You said no — we won't include this.")}
            </p>
          ) : (
            <form action={action} className="flex flex-col gap-ds-3">
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="topic" value={topic} />
              <input type="hidden" name="question" value={question} />
              <div className="flex flex-wrap items-center gap-ds-4" role="group" aria-label="Your answer">
                <Button type="button" variant="secondary" onClick={() => setChoice("yes")} aria-pressed={choice === "yes"}>
                  Yes
                </Button>
                <Button type="submit" name="answer" value="no" variant="link" formNoValidate disabled={pending}>
                  No, I don&apos;t
                </Button>
                <Button type="button" variant="link" onClick={() => setChoice("skip")}>
                  Skip
                </Button>
              </div>
              {choice === "yes" && (
                <div className="flex flex-col gap-ds-2">
                  <label htmlFor={`d-${topic}`} className="text-label-bold">
                    Tell us briefly where and how — we&apos;ll only use what you write.
                  </label>
                  <Textarea id={`d-${topic}`} name="detail" required className="min-h-24 bg-white" placeholder="e.g. Ran WCAG 2.1 AA audits on the Harbor mobile app with our QA team in 2023." />
                  <Button type="submit" name="answer" value="yes" disabled={pending} className="self-start">
                    {pending ? "Saving…" : "Save answer"}
                  </Button>
                </div>
              )}
              <FormMessage state={state} />
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
