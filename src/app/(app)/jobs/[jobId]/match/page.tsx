import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/features/job-flow/ActionForm";
import { StepProgress } from "@/components/features/job-flow/StepProgress";
import { ExperienceSummaryCard } from "@/components/features/match/ExperienceSummaryCard";
import { JobMatchHelp } from "@/components/features/match/ScoreHelp";
import { FitSummary } from "@/components/features/match/FitSummary";
import { GapQuestion } from "@/components/features/match/GapQuestion";
import { RequirementScorecard } from "@/components/features/match/RequirementScorecard";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { CATEGORY_LABELS, MATCH_CATEGORIES, type MatchReport } from "@/server/ai";
import { requireProfile } from "@/server/auth/session";
import { jobProgress } from "@/server/queries/jobs";
import { tailoredResumeIsCurrent } from "@/server/services/job-pipeline";
import { getStore } from "@/server/store";
import { createApplication, recheckMatch } from "../../actions";

export const metadata = { title: "Job match" };

function Chips({ items, tone }: { items: string[]; tone: "match" | "missing" }) {
  return (
    <ul className="flex flex-wrap gap-ds-2">
      {items.map((k) => (
        <li key={k} className={`rounded-pill px-ds-3 py-1 text-body-sm ${tone === "match" ? "bg-sky-50 text-blue-700" : "bg-gray-100"}`}>
          {k}
        </li>
      ))}
    </ul>
  );
}

function GroupHeading({ title, count, note }: { title: string; count: number; note?: string }) {
  return (
    <div className="mb-ds-2">
      <h3 className="text-heading-feature">
        {title} <span className="font-normal">({count})</span>
      </h3>
      {note && <p className="text-body-sm">{note}</p>}
    </div>
  );
}

/** Plain-language "why this score", computed from the same numbers the score uses. */
function explain(m: MatchReport): string {
  const total = m.strong.length + m.partial.length + m.missing.length;
  const cats = MATCH_CATEGORIES.flatMap((c) => (m.scores.categories[c] === null ? [] : [{ c, v: m.scores.categories[c]! }])).sort((a, b) => b.v - a.v);
  const best = cats[0];
  const worst = cats.at(-1);
  return [
    `You fully meet ${m.strong.length} of ${total} requirements${m.partial.length ? ` and partly meet ${m.partial.length} more` : ""}.`,
    best ? `Your strongest area is ${CATEGORY_LABELS[best.c].toLowerCase()} (${best.v}%).` : "",
    worst && worst !== best && worst.v < 100 ? `The biggest gap is ${CATEGORY_LABELS[worst.c].toLowerCase()} (${worst.v}%).` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export default async function MatchPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { user, profile } = await requireProfile();
  const store = await getStore();
  const p = await jobProgress(store, user.id, jobId);
  if (!p.job) notFound();
  if (!p.match || !p.analysis) redirect(`/jobs/${jobId}`);
  const m = p.match.result;
  const a = p.analysis.result;
  const facts = new Map(profile.approvedFacts.map((f) => [f.topic, f]));
  const answerOf = (topic: string) => {
    const f = facts.get(topic);
    return f ? (f.status === "APPROVED" ? ("yes" as const) : ("no" as const)) : undefined;
  };
  const answeredYes = m.questions.some((q) => answerOf(q.topic) === "yes");
  const answeredCount = m.questions.filter((q) => answerOf(q.topic) !== undefined).length;
  const openQuestions = m.questions.length - answeredCount;
  const [optCost, letterCost, matchCost] = await Promise.all([
    store.credits.priceOf("OPTIMIZE_RESUME"),
    store.credits.priceOf("GENERATE_COVER_LETTER"),
    store.credits.priceOf("JOB_MATCH"),
  ]);
  const created = p.completed.includes("create");
  // A tailored resume that is already saved (the task stopped before the cover letter) is kept and not paid for again.
  const resumeSaved = !created && (await tailoredResumeIsCurrent(store, user.id, jobId));

  return (
    <>
      {!created && <StepProgress current="match" jobId={jobId} completed={p.completed} />}
      <PageHeader
        eyebrow={`${p.job.company}${p.job.location ? ` · ${p.job.location}` : ""}`}
        title={p.job.title}
        description={
          <>
            Compared with your profile.
            {a.minYears ? ` This role asks for ${a.minYears}+ years of experience` : ""}
            {a.seniority !== "unspecified" ? `${a.minYears ? " at" : " This is a"} ${a.seniority} level.` : a.minYears ? "." : ""}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-ds-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <aside
          aria-label="Your score and next step"
          className="flex flex-col gap-ds-4 [@media(min-width:1024px)_and_(min-height:820px)]:sticky [@media(min-width:1024px)_and_(min-height:820px)]:top-[84px]"
        >
          <Card id="create" className="flex scroll-mt-[84px] flex-col items-center gap-ds-4">
            <ScoreRing value={m.scores.overall} label="Job Match Score" banded help={<JobMatchHelp />} />
            <p className="text-body-sm text-center">{explain(m)}</p>

            <div className="flex w-full flex-col gap-ds-2">
              {created ? (
                <ButtonLink href={`/jobs/${jobId}`} className="w-full">
                  Review and download
                </ButtonLink>
              ) : (
                <ActionForm
                  action={createApplication}
                  hidden={{ jobId, requestId: crypto.randomUUID() }}
                  label={resumeSaved ? "Write cover letter" : "Create application"}
                  pendingLabel="Writing your documents…"
                  cost={resumeSaved ? letterCost : optCost + letterCost}
                  fullWidth
                />
              )}
              <p className="text-caption text-center">
                {created
                  ? "Your tailored resume and cover letter are ready to review."
                  : resumeSaved
                    ? "Your tailored resume is saved. Only the cover letter is left."
                    : "A resume and cover letter tailored to this job. Your profile stays unchanged."}
              </p>
              {!created && openQuestions > 0 && (
                <a href="#questions" className="text-body-sm text-center text-blue-700 underline">
                  {openQuestions} {openQuestions === 1 ? "question" : "questions"} could improve your match
                </a>
              )}
            </div>

            <div className="flex w-full flex-col gap-ds-3 border-t border-gray-100 pt-ds-4">
              <h2 className="text-label-bold">How your score breaks down</h2>
              {MATCH_CATEGORIES.map((c) => {
                const v = m.scores.categories[c];
                return v === null ? null : <ScoreBar key={c} label={CATEGORY_LABELS[c]} value={v} />;
              })}
            </div>
            <p className="text-caption text-center">An estimate of how well your profile fits this job description — not a prediction of any employer&apos;s decision.</p>
          </Card>
        </aside>

        <div className="flex flex-col gap-ds-4">
          {m.fit && <FitSummary fit={m.fit} />}
          <RequirementScorecard analysis={a} match={m} />

          {m.questions.length > 0 && (
            <Card id="questions" aria-labelledby="questions-h" className="scroll-mt-[84px]">
              <CardHeader
                title={<span id="questions-h">Questions for you</span>}
                subtitle={
                  <>
                    <span className="mb-ds-1 block text-label-bold" aria-live="polite">
                      {answeredCount} of {m.questions.length} answered
                    </span>
                    Answer only if it&apos;s true. Nothing is added to your resume without a yes, and we use your own words.
                  </>
                }
              />
              <ul className="flex flex-col gap-ds-3">
                {m.questions.map((q) => (
                  <GapQuestion key={q.requirementId} jobId={jobId} topic={q.topic} question={q.question} answered={answerOf(q.topic)} savedAnswer={facts.get(q.topic)?.answer} />
                ))}
              </ul>
              {answeredYes && !created && (
                <div className="mt-ds-4 flex flex-col gap-ds-2 border-t border-gray-100 pt-ds-4">
                  <p className="text-body-sm">You added new information. Update your score to see how it changes your match.</p>
                  <ActionForm
                    action={recheckMatch}
                    hidden={{ jobId, requestId: crypto.randomUUID() }}
                    label="Update my match score"
                    pendingLabel="Re-checking…"
                    cost={matchCost}
                    variant="secondary"
                  />
                </div>
              )}
            </Card>
          )}

          {m.experience && <ExperienceSummaryCard summary={m.experience} profession={a.profession ?? null} industry={a.industry ?? null} />}

          <Card aria-labelledby="keywords-h">
            <CardHeader title={<span id="keywords-h">Keywords</span>} subtitle="Terms from the job description, compared with your profile." />
            <div className="flex flex-col gap-ds-4">
              <div>
                <GroupHeading title="Already in your profile" count={m.matchingKeywords.length} />
                {m.matchingKeywords.length ? (
                  <Chips items={m.matchingKeywords} tone="match" />
                ) : (
                  <p className="text-body-sm">None of the job&apos;s keywords appear in your profile yet.</p>
                )}
              </div>
              {m.keywordStrategy && m.keywordStrategy.supported.length > 0 && (
                <div>
                  <GroupHeading title="Shown by your experience" count={m.keywordStrategy.supported.length} note="Your work shows these, in different words. Your tailored resume will use the employer's wording." />
                  <ul className="flex flex-col gap-ds-1 text-body-sm">
                    {m.keywordStrategy.supported.map((k) => (
                      <li key={k.term}>
                        <strong>{k.term}</strong> — {k.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(m.keywordStrategy ? m.keywordStrategy.unsupported : m.missingKeywords).length > 0 && (
                <div>
                  <GroupHeading
                    title="Not added, no evidence"
                    count={(m.keywordStrategy ? m.keywordStrategy.unsupported : m.missingKeywords).length}
                    note="We never add these to your resume unless they're true for you."
                  />
                  <Chips items={m.keywordStrategy ? m.keywordStrategy.unsupported : m.missingKeywords} tone="missing" />
                </div>
              )}
            </div>
          </Card>

          {created && (
            <div className="flex justify-end">
              <ButtonLink href={`/jobs/${jobId}`}>Review and download</ButtonLink>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
