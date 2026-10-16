import { ShieldCheck } from "lucide-react";
import { ActionForm } from "@/components/features/job-flow/ActionForm";
import { JobInput } from "@/components/features/job-flow/JobInput";
import { StepProgress } from "@/components/features/job-flow/StepProgress";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SoftPanel } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfile } from "@/server/auth/session";
import { DEMO_JOB } from "@/server/demo/fixtures";
import { getStore } from "@/server/store";
import { analyzeNewJob } from "../actions";

export const metadata = { title: "Tailor resume to a job" };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ sample?: string }> }) {
  await requireProfile();
  const sample = (await searchParams).sample === "1" ? DEMO_JOB : null;
  const store = await getStore();
  const cost = (await store.credits.priceOf("ANALYZE_JOB")) + (await store.credits.priceOf("JOB_MATCH"));
  return (
    <>
      <StepProgress current="add" completed={[]} />
      <PageHeader
        title="Tailor your resume to a job"
        description="Add the job you want to apply for. We'll compare it with your profile and Master Resume and show how well you match."
        actions={!sample && <ButtonLink href="/jobs/new?sample=1" variant="link">Try a sample job</ButtonLink>}
      />
      <div className="grid gap-ds-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <ActionForm action={analyzeNewJob} hidden={{ requestId: crypto.randomUUID() }} label="Analyze job" pendingLabel="Analyzing the job…" cost={cost}>
            <div className="mb-ds-5 flex flex-col gap-ds-4">
              <JobInput defaultText={sample?.description} />
              <div className="grid gap-ds-4 md:grid-cols-2">
                <Field label="Job title" htmlFor="title">
                  <Input id="title" name="title" placeholder="Senior UX Designer" defaultValue={sample?.title} />
                </Field>
                <Field label="Company name" htmlFor="company">
                  <Input id="company" name="company" placeholder="Company" defaultValue={sample?.company} />
                </Field>
                <Field label="Location" htmlFor="location">
                  <Input id="location" name="location" placeholder="City, remote or hybrid" defaultValue={sample?.location} />
                </Field>
                <Field label="Job URL" htmlFor="url">
                  <Input id="url" name="url" type="url" placeholder="https://" defaultValue={sample?.url} />
                </Field>
              </div>
            </div>
          </ActionForm>
        </Card>
        <SoftPanel className="flex h-fit flex-col gap-ds-3">
          <ShieldCheck size={32} className="text-blue-600" aria-hidden="true" />
          <h2 className="text-heading-feature">Only what&apos;s true about you</h2>
          <p className="text-body-sm">We never add experience, skills, education or results you haven&apos;t given us. If the job asks for something we can&apos;t find, we&apos;ll show it as missing — and you can tell us if you have it.</p>
        </SoftPanel>
      </div>
    </>
  );
}
