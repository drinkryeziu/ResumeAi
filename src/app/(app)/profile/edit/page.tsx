import { CvImport } from "@/components/features/profile/CvImport";
import { ImportBanner } from "@/components/features/profile/ImportBanner";
import { ProfileEditor } from "@/components/features/profile/ProfileEditor";
import { SoftPanel } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfile } from "@/server/auth/session";
import { mergeDraftIntoInput, toProfileInput } from "@/server/domain/profile-mapping";
import { getStore } from "@/server/store";

export const metadata = { title: "Update profile" };

export default async function EditProfilePage() {
  const { user, profile } = await requireProfile();
  const cv = await (await getStore()).getCvImport(user.id);
  const base = toProfileInput(profile, user.email, "");
  const merged = cv ? mergeDraftIntoInput(base, cv.draft) : null;
  return (
    <>
      <PageHeader title="Update your professional profile" description="Changes apply to new documents. Resumes you've already tailored keep their saved versions." />
      {merged && cv ? (
        <ImportBanner fileName={cv.fileName} added={merged.added} returnTo="edit" />
      ) : (
        <SoftPanel className="mb-ds-4 flex flex-col gap-ds-3">
          <div>
            <h2 className="text-card-title">Import from a CV</h2>
            <p className="text-body-sm mt-ds-1">Upload a newer CV to add jobs, education and skills you haven&apos;t entered yet. Nothing you&apos;ve already written is overwritten.</p>
          </div>
          <CvImport returnTo="edit" requestId={crypto.randomUUID()} compact />
        </SoftPanel>
      )}
      <ProfileEditor key={cv ? cv.createdAt.toISOString() : "saved"} initial={merged?.input ?? base} firstTime={false} requestId={crypto.randomUUID()} />
    </>
  );
}
