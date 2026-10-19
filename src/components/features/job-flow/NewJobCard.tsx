import { analyzeNewJob } from "@/app/(app)/jobs/actions";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import type { DEMO_JOB } from "@/server/demo/fixtures";
import { ActionForm } from "./ActionForm";
import { JobInput } from "./JobInput";

/**
 * Step 1 of the job flow, shown on the dashboard: paste or upload a job description and start the match.
 * The button is the card's one primary action, full width at the end of the form, with its credit price.
 */
export function NewJobCard({ cost, sample }: { cost: number; sample: typeof DEMO_JOB | null }) {
  return (
    <section id="tailor" aria-labelledby="tailor-h" className="scroll-mt-[84px]">
      <Card className="flex flex-col gap-ds-4">
        <div className="flex flex-wrap items-end justify-between gap-ds-3">
          <div className="flex flex-col gap-ds-1">
            <h2 id="tailor-h" className="text-card-title">
              Tailor your resume to a job
            </h2>
            <p className="text-body-sm max-w-xl">Paste the job description. We compare it with your profile and show your Job Match Score.</p>
          </div>
          {!sample && (
            <ButtonLink href="/dashboard?sample=1#tailor" variant="link">
              Try a sample job
            </ButtonLink>
          )}
        </div>
        <ActionForm action={analyzeNewJob} hidden={{ requestId: crypto.randomUUID() }} label="Tailor your resume to a job" pendingLabel="Analyzing the job…" cost={cost} fullWidth>
          <div className="mb-ds-4 flex flex-col gap-ds-4">
            <JobInput defaultText={sample?.description} />
            <div className="grid gap-ds-4 md:grid-cols-2">
              <Field label="Job title" htmlFor="title">
                <Input id="title" name="title" placeholder="Senior UX Designer" defaultValue={sample?.title} />
              </Field>
              <Field label="Company name" htmlFor="company">
                <Input id="company" name="company" placeholder="Company" defaultValue={sample?.company} />
              </Field>
              <Field label="Link to the job posting" htmlFor="url">
                <Input id="url" name="url" type="url" placeholder="https://" defaultValue={sample?.url} />
              </Field>
              <Field label="Location" htmlFor="location">
                <Input id="location" name="location" placeholder="City, remote or hybrid" defaultValue={sample?.location} />
              </Field>
            </div>
          </div>
        </ActionForm>
        <p className="text-caption">
          We never add experience, skills, education or results you haven&apos;t given us. If the job asks for something we can&apos;t find, it shows as missing.
        </p>
      </Card>
    </section>
  );
}
