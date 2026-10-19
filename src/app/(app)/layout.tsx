import { Suspense } from "react";
import { FlashToast } from "@/components/features/notices/FlashToast";
import { LegalLinks } from "@/components/features/legal/LegalLinks";
import { ToastProvider } from "@/components/ui/Toast";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { requireUser } from "@/server/auth/session";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";
// Real model calls (job analysis, resume and letter writing, CV reading) can take a while; the default limit would cut them off.
export const maxDuration = 60;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const store = await getStore();
  const [balance, account, profile] = await Promise.all([store.credits.balance(user.id), store.getUser(user.id), store.findProfile(user.id)]);
  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : (account?.name ?? user.email);
  return (
    <ToastProvider>
      <SiteHeader creditBalance={balance} name={name} email={user.email} setup={!profile} />
      <main className="mx-auto w-full max-w-[1120px] px-ds-4 py-ds-5 md:px-ds-5">{children}</main>
      <footer className="mx-auto w-full max-w-[1120px] px-ds-4 pb-ds-5 text-caption md:px-ds-5">
        <LegalLinks />
      </footer>
      <Suspense>
        <FlashToast />
      </Suspense>
    </ToastProvider>
  );
}
