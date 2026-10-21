import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { ActionForm } from "@/components/features/job-flow/ActionForm";
import { StepProgress } from "@/components/features/job-flow/StepProgress";
import { DocumentWorkspace, type DocTab } from "@/components/features/documents/DocumentWorkspace";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, SoftPanel } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ATS_LABELS, TONES } from "@/server/ai";
import { requireProfile } from "@/server/auth/session";
import { jobProgress } from "@/server/queries/jobs";
import { getStore } from "@/server/store";
import { continueAnalysis, improveResume, rewriteCoverLetter, runAtsCheck } from "../actions";

export const metadata = { title: "Your application" };

const TONE_LABEL = { PROFESSIONAL: "Professional", CONVERSATIONAL: "Conversational", EXECUTIVE: "Executive", CONCISE: "Concise", ENTHUSIASTIC: "Enthusiastic" } as const;

/** Step 4 — Review & download. Before the application exists, this sends the user to the match. */
export default async function JobApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ doc?: string; mode?: string; new?: string }>;
}) {
  const [{ jobId }, sp] = await Promise.all([params, searchParams]);
  const { user } = await requireProfile();
  const store = await getStore();
  const p = await jobProgress(store, user.id, jobId);
  if (!p.job) notFound();
  const unfinished = !p.completed.includes("create");
  // With a resume or cover letter saved the page opens, so each can be edited or downloaded from the Documents tab even if the other was deleted.
  if (unfinished && !p.resume && !p.letter) {
    if (p.match) redirect(`/jobs/${jobId}/match`);
    // Saved, but not fully analyzed (for example the credits ran out): pick up from the saved state, paying only for what is left.
    const todo = { analysis: !p.analysis, match: true };
    const price = (await Promise.all([todo.analysis ? store.credits.priceOf("ANALYZE_JOB") : 0, store.credits.priceOf("JOB_MATCH")])).reduce<number>((a, b) => a + b, 0);
    return (
      <>
        <PageHeader
          eyebrow={`${p.job.company}${p.job.location ? ` · ${p.job.location}` : ""}`}
          title={p.job.title}
          description="Your job is saved. Pick up where you left off."
          actions={
            <ButtonLink href="/dashboard" variant="link">
              Back to dashboard
            </ButtonLink>
          }
        />
        <Card aria-labelledby="pickup-h" className="max-w-xl">
          <CardHeader
            title={<span id="pickup-h">{p.analysis ? "Next: check your match" : "Next: analyze this job"}</span>}
            subtitle={
              p.analysis
                ? "Your job description and its analysis are saved. We'll compare the job with your profile and give you a Job Match Score."
                : "Your job description is saved. We'll read it, then compare it with your profile and give you a Job Match Score."
            }
          />
          <ActionForm
            action={continueAnalysis}
            hidden={{ jobId, requestId: crypto.randomUUID() }}
            label={p.analysis ? "Check my match" : "Analyze job"}
            pendingLabel="Analyzing the job…"
            cost={price}
          />
        </Card>
      </>
    );
  }

  const fresh = sp.new === "1";
  const tab: DocTab = sp.doc === "cover-letter" ? "cover-letter" : "resume";
  const currentResume = p.resume?.versions.find((v) => v.id === p.resume!.currentVersionId);
  const ats = p.ats && p.ats.resumeVersionId === currentResume?.id ? p.ats : null; // a check only applies to the version it ran on
  const currentLetter = p.letter?.versions.find((v) => v.id === p.letter!.currentVersionId);
  const [atsCost, optCost, editCost, genCost] = await Promise.all(
    ["ATS_CHECK", "OPTIMIZE_RESUME", "EDIT_COVER_LETTER", "GENERATE_COVER_LETTER"].map((k) => store.credits.priceOf(k)),
  );
  const rid = () => crypto.randomUUID();
  const fixes = new Set(ats?.result.scores.findings.filter((f) => !f.ok).map((f) => f.fix) ?? []);
  const suggestions = (ats?.result.advice.suggestions ?? []).filter((s) => !fixes.has(s)); // don't repeat the issues list

  const resumeSide = !currentResume ? undefined : (
    <Card id="ats" className="scroll-mt-[84px]">
      <CardHeader title="ATS compatibility" subtitle="Optional: check how this version's structure and keywords line up with the job." />
      {ats ? (
        <div className="flex flex-col gap-ds-4">
          <ScoreRing value={ats.overallScore} label="ATS Compatibility Score" size={112} />
          <div className="flex flex-col gap-ds-2">
            {(Object.keys(ATS_LABELS) as Array<keyof typeof ATS_LABELS>).map((k) => (
              <ScoreBar key={k} label={ATS_LABELS[k]} value={ats.result.scores.categories[k]} />
            ))}
          </div>
          {ats.result.scores.findings.some((f) => !f.ok) && (
            <ul className="flex flex-col gap-ds-1">
              {ats.result.scores.findings
                .filter((f) => !f.ok)
                .map((f) => (
                  <li key={f.id} className="flex gap-ds-2 text-body-sm">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                    {f.fix}
                  </li>
                ))}
            </ul>
          )}
          {suggestions.length > 0 && (
            <ul className="flex list-disc flex-col gap-ds-1 pl-5 text-body-sm">
              {suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
          <ActionForm action={improveResume} hidden={{ jobId, requestId: rid() }} label="Improve resume" pendingLabel="Improving…" cost={optCost} variant="secondary">
            {ats.result.scores.findings
              .filter((f) => !f.ok)
              .map((f) => (
                <input key={f.id} type="hidden" name="improve" value={f.fix} />
              ))}
            {ats.result.advice.suggestions.map((s) => (
              <input key={s} type="hidden" name="improve" value={s} />
            ))}
          </ActionForm>
          <p className="text-caption">Employers&apos; systems differ; this is an estimate, not a guarantee.</p>
        </div>
      ) : (
        <ActionForm action={runAtsCheck} hidden={{ jobId, requestId: rid() }} label="Run ATS check" pendingLabel="Checking…" cost={atsCost} variant="secondary" />
      )}
    </Card>
  );

  const letterSide = currentLetter && (
    <Card>
      <CardHeader title="Rewrite with AI" subtitle="Each rewrite is saved as a new version." />
      <ActionForm
        action={rewriteCoverLetter}
        hidden={{ jobId, mode: "retone", requestId: rid() }}
        label="Change tone"
        pendingLabel="Rewriting…"
        cost={editCost}
        variant="secondary"
      >
        <fieldset className="mb-ds-3 flex flex-wrap gap-ds-2">
          <legend className="sr-only">Tone</legend>
          {TONES.map((t) => (
            <label key={t} className="cursor-pointer">
              <input type="radio" name="tone" value={t} defaultChecked={t === currentLetter.tone} className="peer sr-only" />
              <span className="inline-block rounded-pill bg-gray-100 px-ds-3 py-1.5 text-body-sm peer-checked:bg-blue-600 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-blue-600">
                {TONE_LABEL[t]}
              </span>
            </label>
          ))}
        </fieldset>
      </ActionForm>
      <div className="mt-ds-4 flex flex-wrap gap-ds-3">
        <ActionForm
          action={rewriteCoverLetter}
          hidden={{ jobId, mode: "shorten", tone: currentLetter.tone, requestId: rid() }}
          label="Shorten"
          pendingLabel="Shortening…"
          variant="secondary"
        />
        <ActionForm
          action={rewriteCoverLetter}
          hidden={{ jobId, mode: "expand", tone: currentLetter.tone, requestId: rid() }}
          label="Expand"
          pendingLabel="Expanding…"
          variant="secondary"
        />
        <ActionForm
          action={rewriteCoverLetter}
          hidden={{ jobId, mode: "generate", tone: currentLetter.tone, requestId: rid() }}
          label="Regenerate"
          pendingLabel="Writing…"
          variant="secondary"
        />
      </div>
      <p className="text-caption mt-ds-3">
        Shorten, expand and tone: {editCost} credits · Regenerate: {genCost} credits
      </p>
    </Card>
  );

  return (
    <>
      {/* The four steps are shown while the application is being made for the first time, not when an earlier one is reopened. */}
      {fresh && <StepProgress current="review" jobId={jobId} completed={p.completed} />}
      <PageHeader
        eyebrow={`Job match ${p.match?.overallScore ?? "—"}%${ats ? ` · ATS ${ats.overallScore}%` : ""}`}
        title={`${p.job.title} — ${p.job.company}`}
        description="Review and edit your tailored resume and cover letter, then download them and apply on the company's site or job board."
      />
      {unfinished && (
        <SoftPanel className="mb-ds-4 flex flex-wrap items-center justify-between gap-ds-3">
          <p className="text-body-sm max-w-xl">
            <strong>This application isn&apos;t finished.</strong> {currentResume ? "Its cover letter is missing." : "Its resume is missing."} What is saved stays as it is.
          </p>
          <ButtonLink href={`/jobs/${jobId}/match`} variant="secondary" compact>
            Finish the application
          </ButtonLink>
        </SoftPanel>
      )}
      <DocumentWorkspace
        target={jobId}
        basePath={`/jobs/${jobId}`}
        tab={tab}
        editing={sp.mode === "edit"}
        resume={p.resume}
        letter={p.letter}
        resumeSide={resumeSide}
        letterSide={letterSide}
        fresh={fresh}
      />
      <SoftPanel className="mt-ds-5 flex flex-wrap items-center justify-between gap-ds-4">
        <p className="text-body-sm max-w-xl">
          <strong>Next: apply yourself.</strong> Upload these files on the company&apos;s careers site, LinkedIn, Indeed, Workday or Glassdoor. ResumeAi never submits applications
          for you.
        </p>
        {p.job.url && (
          <a href={p.job.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-body-sm text-blue-700 underline">
            Open the job posting <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </SoftPanel>
    </>
  );
}
