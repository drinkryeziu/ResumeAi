import { CareerAnalysisCard } from "@/components/features/match/CareerAnalysisCard";
import { DocumentWorkspace, type DocTab } from "@/components/features/documents/DocumentWorkspace";
import { ActionForm } from "@/components/features/job-flow/ActionForm";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfile } from "@/server/auth/session";
import { getStore } from "@/server/store";
import { regenerateMasterDocuments } from "../jobs/actions";

export const metadata = { title: "Master Resume & Cover Letter" };

/** The Master documents: built from the profile, the starting point for every tailored application. */
export default async function MasterPage({ searchParams }: { searchParams: Promise<{ doc?: string; mode?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireProfile();
  const store = await getStore();
  const [resume, letter] = await Promise.all([store.resumeForJob(user.id, null), store.coverLetterForJob(user.id, null)]);
  const analysis = resume?.versions.find((v) => v.id === resume.currentVersionId)?.content.analysis;
  const tab: DocTab = sp.doc === "cover-letter" ? "cover-letter" : "resume";

  const regenerate = (
    <Card>
      <CardHeader title="Update from your profile" subtitle="Changed your profile? Recreate both Master documents. Your current versions stay in history." />
      <ActionForm
        action={regenerateMasterDocuments}
        hidden={{ jobId: "master", requestId: crypto.randomUUID() }}
        label="Regenerate both"
        pendingLabel="Recreating…"
        variant="secondary"
      />
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Your Master Resume & Cover Letter"
        description="Built from your profile and the starting point for every application. Tailoring to a job never changes them."
        actions={
          <ButtonLink href="/dashboard#tailor" variant="secondary">
            Tailor to a job
          </ButtonLink>
        }
      />
      <DocumentWorkspace
        target="master"
        basePath="/master"
        tab={tab}
        editing={sp.mode === "edit"}
        resume={resume}
        letter={letter}
        resumeSide={
          <>
            {analysis && <CareerAnalysisCard analysis={analysis} />}
            {regenerate}
          </>
        }
        letterSide={regenerate}
      />
    </>
  );
}
