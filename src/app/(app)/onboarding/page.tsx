import { redirect } from "next/navigation";
import { Keyboard } from "lucide-react";
import { CvImport } from "@/components/features/profile/CvImport";
import { ImportBanner } from "@/components/features/profile/ImportBanner";
import { ProfileEditor } from "@/components/features/profile/ProfileEditor";
import { Card, SoftPanel } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/server/auth/session";
import { mergeDraftIntoInput, toProfileInput } from "@/server/domain/profile-mapping";
import { getStore } from "@/server/store";

export const metadata = { title: "Create your profile" };

/**
 * First-time users land here after sign-up. Two ways in: upload a CV to pre-fill the form, or type it.
 * Either way the user reviews and saves; saving creates the Master Resume + Master Cover Letter.
 */
export default async function OnboardingPage() {
  const user = await requireUser();
  const store = await getStore();
  if (await store.findProfile(user.id)) redirect("/dashboard");
  const [account, cv] = await Promise.all([store.getUser(user.id), store.getCvImport(user.id)]);
  const base = toProfileInput(null, user.email, account?.name ?? "");
  const merged = cv ? mergeDraftIntoInput(base, cv.draft) : null;

  return (
    <>
      <PageHeader
        eyebrow="Welcome to ApplyAI"
        title="Create your professional profile"
        description="Fill this in once. It becomes the source of truth for every resume and cover letter we create — we only ever use what you put here."
      />
      {merged && cv ? (
        <ImportBanner fileName={cv.fileName} added={merged.added} returnTo="onboarding" />
      ) : (
        <div className="mb-ds-5 grid gap-ds-4 lg:grid-cols-[1.4fr_1fr]">
          <SoftPanel className="flex flex-col gap-ds-3">
            <div>
              <h2 className="text-card-title">Already have a CV? Upload it</h2>
              <p className="text-body-sm mt-ds-1">We&apos;ll fill in the form for you from your CV. You check it, fix anything, then save — it takes a minute instead of twenty.</p>
            </div>
            <CvImport returnTo="onboarding" requestId={crypto.randomUUID()} />
          </SoftPanel>
          <Card className="flex flex-col justify-center gap-ds-2">
            <Keyboard size={28} className="text-blue-600" aria-hidden="true" />
            <h2 className="text-card-title">Or fill it in yourself</h2>
            <p className="text-body-sm">No CV yet? Start with the form below — you can save and come back to add more any time.</p>
          </Card>
        </div>
      )}
      <ProfileEditor key={cv ? cv.createdAt.toISOString() : "blank"} initial={merged?.input ?? base} firstTime requestId={crypto.randomUUID()} />
    </>
  );
}
