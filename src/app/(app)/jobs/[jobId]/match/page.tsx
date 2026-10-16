import { notFound, redirect } from "next/navigation";
import { CheckCircle2, CircleDashed, CircleSlash } from "lucide-react";
import type { ReactNode } from "react";
import { ActionForm } from "@/components/features/job-flow/ActionForm";
import { StepProgress } from "@/components/features/job-flow/StepProgress";
import { GapQuestion } from "@/components/features/match/GapQuestion";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { CATEGORY_LABELS, MATCH_CATEGORIES, type MatchReport } from "@/server/ai";
import { requireProfile } from "@/server/auth/session";
import { jobProgress } from "@/server/queries/jobs";
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

function MatchList({ title, items, icon, empty, note }: { title: string; items: string[]; icon: ReactNode; empty: string; note?: string }) {
  return (
    <Card>
      <CardHeader title={`${title} (${items.length})`} subtitle={note} />
      {items.length === 0 ? (
        <p className="text-body-sm">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-ds-2">
          {items.map((t) => (
            <li key={t} className="flex gap-ds-2 text-body-sm">
              <span className="mt-0.5 shrink-0" aria-hidden="true">
                {icon}
              </span>
              {t}
            </li>
          ))}
        </ul>
      )}
    </Card>
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
  const answers = new Map(profile.approvedFacts.map((f) => [f.topic, f.status === "APPROVED" ? ("yes" as const) : ("no" as const)]));
  const answeredYes = m.questions.some((q) => answers.get(q.topic) === "yes");
  const [optCost, letterCost, matchCost] = await Promise.all([
    store.credits.priceOf("OPTIMIZE_RESUME"),
    store.credits.priceOf("GENERATE_COVER_LETTER"),
    store.credits.priceOf("JOB_MATCH"),
  ]);
  const created = p.completed.includes("create");

  return (
    <>
      <StepProgress current={created ? "review" : "match"} jobId={jobId} completed={p.completed} />
      <PageHeader
        eyebrow={`${p.job.company}${p.job.location ? ` · ${p.job.location}` : ""}`}
        title={p.job.title}
        description={
          <>
            Compared with your profile and Master Resume.
            {a.minYears ? ` This role asks for ${a.minYears}+ years of experience` : ""}
            {a.seniority !== "unspecified" ? `${a.minYears ? " at" : " This is a"} ${a.seniority} level.` : a.minYears ? "." : ""}
          </>
        }
      />

      <div className="grid gap-ds-4 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-ds-4">
          <Card className="flex flex-col items-center gap-ds-4">
            <ScoreRing value={m.scores.overall} label="Job Match Score" />
            <p className="text-body-sm text-center">{explain(m)}</p>
            <div className="flex w-full flex-col gap-ds-3">
              {MATCH_CATEGORIES.map((c) => {
                const v = m.scores.categories[c];
                return v === null ? null : <ScoreBar key={c} label={CATEGORY_LABELS[c]} value={v} />;
              })}
            </div>
            <p className="text-caption text-center">An estimate of how well your profile fits this job description — not a prediction of any employer&apos;s decision.</p>
          </Card>
        </div>

        <div className="flex flex-col gap-ds-4">
          <Card id="create" className="flex flex-wrap items-center justify-between gap-ds-4 scroll-mt-[84px]">
            <div className="flex max-w-md flex-col gap-ds-1">
              <h2 className="text-card-title">{created ? "Your application is ready" : "Good match? Create your application"}</h2>
              <p className="text-body-sm">
                {created
                  ? "Review, edit and download your tailored resume and cover letter."
                  : `We'll write a resume and cover letter tailored to ${p.job.company}. Your Master Resume stays unchanged.`}
              </p>
            </div>
            {created ? (
              <ButtonLink href={`/jobs/${jobId}`}>Review & download</ButtonLink>
            ) : (
              <ActionForm action={createApplication} hidden={{ jobId, requestId: crypto.randomUUID() }} label="Create application" pendingLabel="Writing your resume and cover letter…" cost={optCost + letterCost} />
            )}
          </Card>

          <MatchList title="Strong qualifications" items={m.strong} empty="None found yet." icon={<CheckCircle2 size={16} className="text-success" />} />

          <Card>
            <CardHeader title="Matching skills" subtitle="Job keywords already in your profile." />
            {m.matchingKeywords.length ? <Chips items={m.matchingKeywords} tone="match" /> : <p className="text-body-sm">None of the job&apos;s keywords appear in your profile yet.</p>}
          </Card>

          <div className="grid gap-ds-4 md:grid-cols-2">
            <MatchList
              title="Areas to improve"
              items={m.partial}
              empty="Nothing here."
              note="You have related experience — the tailored resume will state it more clearly."
              icon={<CircleDashed size={16} className="text-blue-600" />}
            />
            <MatchList title="Missing requirements" items={m.missing} empty="Nothing missing." note="Not found in your profile." icon={<CircleSlash size={16} className="text-gray-500" />} />
          </div>

          <Card>
            <CardHeader title={`Missing keywords (${m.missingKeywords.length})`} subtitle="Job terms not in your profile. We'll only add them if they're true for you." />
            {m.missingKeywords.length ? <Chips items={m.missingKeywords} tone="missing" /> : <p className="text-body-sm">None — your profile covers the job&apos;s keywords.</p>}
          </Card>

          {m.questions.length > 0 && (
            <Card>
              <CardHeader title="Do you have this experience?" subtitle="If something missing is actually true for you, tell us in your own words. Nothing is added without a Yes." />
              <ul className="flex flex-col gap-ds-3">
                {m.questions.map((q) => (
                  <GapQuestion key={q.requirementId} jobId={jobId} topic={q.topic} question={q.question} answered={answers.get(q.topic)} />
                ))}
              </ul>
              {answeredYes && !created && (
                <div className="mt-ds-4">
                  <ActionForm action={recheckMatch} hidden={{ jobId, requestId: crypto.randomUUID() }} label="Update my match score" pendingLabel="Re-checking…" cost={matchCost} variant="secondary" />
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
