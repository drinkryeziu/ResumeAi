import { redirect } from "next/navigation";
import { Keyboard } from "lucide-react";
import { CvImport } from "@/components/features/profile/CvImport";
import { ImportBanner } from "@/components/features/profile/ImportBanner";
import { ProfileEditor } from "@/components/features/profile/ProfileEditor";
import { Card, SoftPanel } from "@/components/ui/Card";
import { Brand } from "@/components/ui/Brand";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/server/auth/session";
import { mergeDraftIntoInput, toProfileInput } from "@/server/domain/profile-mapping";
import { getStore } from "@/server/store";

export const metadata = { title: "Create your profile" };

/**
 * First-time users land here after sign-up (and any signed-in page without a profile redirects here). Two ways in:
 * upload or paste a CV to pre-fill the form, or type it. The form is a four-step setup ending in a review;
 * creating it saves the profile (the Master documents behind it are written out of sight) and lands on /profile with a notice.
 */
export default async function OnboardingPage() {
  const user = await requireUser();
  const store = await getStore();
  if (await store.findProfile(user.id)) redirect("/dashboard");
  const [account, cv] = await Promise.all([store.getUser(user.id), store.getCvImport(user.id)]);
  const base = toProfileInput(null, user.email, account?.name ?? "");
  const merged = cv ? mergeDraftIntoInput(base, cv.draft) : null;

  const intro = (
    <>
      {merged && cv ? (
        <ImportBanner fileName={cv.fileName} added={merged.added} returnTo="onboarding" />
      ) : (
        <div className="grid gap-ds-4 md:grid-cols-[1.5fr_1fr]">
          <SoftPanel className="flex flex-col gap-ds-3">
            <div>
              <h2 className="text-card-title">Already have a CV? Upload or paste it</h2>
              <p className="text-body-sm mt-ds-1">
                We&apos;ll fill in the form for you from your CV. You check each step and fix anything we read wrong. Nothing is saved until you create your
                profile.
              </p>
            </div>
            <CvImport returnTo="onboarding" requestId={crypto.randomUUID()} />
          </SoftPanel>
          <Card className="flex flex-col justify-center gap-ds-2">
            <Keyboard size={28} className="text-blue-600" aria-hidden="true" />
            <h2 className="text-card-title">Or fill it in yourself</h2>
            <p className="text-body-sm">No CV yet? Start with the fields below. It takes about five minutes, and you can add more any time.</p>
          </Card>
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <PageHeader
        eyebrow={
          <>
            Welcome to <Brand />
          </>
        }
        title="Create your professional profile"
        description="Tell us about your work once, and every job application starts from it. We only ever use what you put here, and creating your profile is free."
      />
      <ProfileEditor key={cv ? cv.createdAt.toISOString() : "blank"} initial={merged?.input ?? base} firstTime requestId={crypto.randomUUID()} intro={intro} />
    </div>
  );
}
