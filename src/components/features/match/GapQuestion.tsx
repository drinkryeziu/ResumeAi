"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, CircleHelp } from "lucide-react";
import { answerQuestion } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { FormMessage } from "@/components/features/job-flow/ActionForm";

const MAX_DETAIL = 600; // matches the server-side limit in answerQuestion

/**
 * "Do you have experience with X?" — Yes asks for the user's own words (stored as an approved fact),
 * No is remembered so it's never claimed or asked again, Not now just collapses it (and can be undone).
 */
export function GapQuestion({
  jobId,
  topic,
  question,
  answered,
  savedAnswer,
}: {
  jobId: string;
  topic: string;
  question: string;
  answered?: "yes" | "no";
  savedAnswer?: string | null;
}) {
  const [choice, setChoice] = useState<"yes" | "skip" | null>(null);
  const [detail, setDetail] = useState("");
  const [state, action, pending] = useActionState(answerQuestion, undefined);
  const detailRef = useRef<HTMLTextAreaElement>(null);
  const saidYes = answered === "yes" || (Boolean(state?.ok) && choice === "yes");
  const saidNo = answered === "no" || (Boolean(state?.ok) && choice !== "yes");
  const done = saidYes || saidNo;
  const shownAnswer = savedAnswer ?? (saidYes ? detail.trim() : null);
  const showTopic = !question.toLowerCase().includes(topic.toLowerCase());

  useEffect(() => {
    if (choice === "yes") detailRef.current?.focus();
  }, [choice]);

  if (choice === "skip" && !done) {
    return (
      <li className="flex items-center justify-between gap-ds-3 rounded-md bg-gray-100 px-ds-4 py-ds-3 text-body-sm">
        <span className="min-w-0 truncate">Skipped for now: {topic}</span>
        <Button type="button" variant="link" onClick={() => setChoice(null)}>
          Undo
        </Button>
      </li>
    );
  }

  return (
    <li className={done ? "rounded-md bg-white p-ds-4 shadow-card" : "rounded-md bg-sky-50 p-ds-4"}>
      <div className="flex gap-ds-3">
        {done ? (
          <Check size={20} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <CircleHelp size={20} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-ds-3">
          <div className="flex flex-col gap-ds-1">
            {showTopic && <p className="text-caption">Requirement: {topic}</p>}
            <p className={done ? "text-body-sm" : "text-body"}>{question}</p>
          </div>

          {done ? (
            <div role="status" className="flex flex-col gap-ds-1 text-body-sm">
              <p className="text-label-bold text-success">{saidYes ? "You said yes" : "You said no"}</p>
              {saidYes ? (
                <>
                  {shownAnswer && <p>&ldquo;{shownAnswer}&rdquo;</p>}
                  <p className="text-caption">We&apos;ll use your answer, in your words, when we create your application.</p>
                </>
              ) : (
                <p className="text-caption">We won&apos;t include this, and we won&apos;t ask again.</p>
              )}
            </div>
          ) : (
            <form action={action} className="flex flex-col gap-ds-3">
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="topic" value={topic} />
              <input type="hidden" name="question" value={question} />
              <div className="flex flex-wrap items-center gap-x-ds-4 gap-y-ds-2" role="group" aria-label="Your answer">
                <Button type="button" variant="secondary" onClick={() => setChoice("yes")} aria-pressed={choice === "yes"} aria-expanded={choice === "yes"}>
                  Yes, I have this
                </Button>
                <Button type="submit" name="answer" value="no" variant="link" formNoValidate disabled={pending}>
                  No, I don&apos;t
                </Button>
                <Button type="button" variant="link" onClick={() => setChoice("skip")}>
                  Not now
                </Button>
              </div>
              {choice === "yes" && (
                <div className="flex flex-col gap-ds-2">
                  <label htmlFor={`d-${jobId}-${topic}`} className="text-label-bold">
                    Where and how? Use your own words — we only use what you write.
                  </label>
                  <Textarea
                    id={`d-${jobId}-${topic}`}
                    ref={detailRef}
                    name="detail"
                    required
                    maxLength={MAX_DETAIL}
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    className="min-h-24 bg-white"
                    placeholder="e.g. Ran WCAG 2.1 AA audits on the Harbor mobile app with our QA team in 2023."
                  />
                  <div className="flex flex-wrap items-center justify-between gap-ds-3">
                    <Button type="submit" name="answer" value="yes" variant="secondary" disabled={pending || !detail.trim()}>
                      {pending ? "Saving…" : "Save answer"}
                    </Button>
                    <span className="text-caption" aria-hidden="true">
                      {detail.length}/{MAX_DETAIL}
                    </span>
                  </div>
                </div>
              )}
              <FormMessage state={state?.ok ? undefined : state} />
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
