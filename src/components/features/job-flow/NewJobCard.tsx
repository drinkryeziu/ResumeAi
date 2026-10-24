import { Briefcase } from "lucide-react";
import { analyzeNewJob } from "@/app/(app)/jobs/actions";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { ActionForm } from "./ActionForm";
import { JobInput } from "./JobInput";

/**
 * Step 1 of the job flow, shown on the dashboard: paste or upload a job description and start the match.
 * The button is the card's one primary action, full width at the end of the form, with its credit price.
 */
export function NewJobCard({ cost }: { cost: number }) {
  return (
    <section id="tailor" aria-labelledby="tailor-h" className="scroll-mt-[84px]">
      {/* The dashboard's one sand-300 moment: a strip across the top of the main action. */}
      <Card className="relative flex flex-col gap-ds-4 overflow-hidden pt-ds-5">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 au-grad-full" />
        <div className="flex flex-wrap items-start justify-between gap-ds-3">
          <div className="flex items-start gap-ds-3">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-sky-50 text-blue-600">
              <Briefcase size={24} />
            </span>
            <div className="flex flex-col gap-ds-1">
              <h2 id="tailor-h" className="text-heading-section text-blue-700">
                Tailor your resume to a job
              </h2>
              <p className="text-body-sm max-w-xl">Paste the job description. We compare it with your profile and show your Job Match Score.</p>
            </div>
          </div>
        </div>
        <ActionForm
          action={analyzeNewJob}
          hidden={{ requestId: crypto.randomUUID() }}
          label="Tailor your resume to a job"
          pendingLabel="Analyzing the job…"
          cost={cost}
          fullWidth
          needs={{
            oneOf: { names: ["description", "file"], label: "the job description (or upload a file)" },
            all: [
              { name: "title", label: "the job title" },
              { name: "company", label: "the company name" },
              { name: "location", label: "the location" },
            ],
          }}
        >
          <div className="mb-ds-4 flex flex-col gap-ds-4">
            <JobInput />
            <div className="grid gap-ds-4 md:grid-cols-2">
              <Field label="Job title" htmlFor="title" required plain>
                <Input id="title" name="title" autoComplete="off" placeholder="Senior UX Designer" />
              </Field>
              <Field label="Company name" htmlFor="company" required plain>
                <Input id="company" name="company" autoComplete="off" placeholder="Company" />
              </Field>
              <Field label="Link to the job posting" htmlFor="url">
                <Input id="url" name="url" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="https://" />
              </Field>
              <Field label="Location" htmlFor="location" required plain>
                <Input id="location" name="location" autoComplete="off" placeholder="City, remote or hybrid" />
              </Field>
            </div>
          </div>
        </ActionForm>
        <p className="text-caption">
          We never add experience, skills, education or results you haven&apos;t given us. If the job asks for something we can&apos;t find, it shows as
          missing.
        </p>
      </Card>
    </section>
  );
}
