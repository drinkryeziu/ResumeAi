import { SiteHeader } from "@/components/layout/SiteHeader";
import { requireUser } from "@/server/auth/session";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const store = await getStore();
  const [balance, account, profile] = await Promise.all([store.credits.balance(user.id), store.getUser(user.id), store.findProfile(user.id)]);
  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : (account?.name ?? user.email);
  return (
    <>
      <SiteHeader creditBalance={balance} name={name} email={user.email} />
      <main className="mx-auto w-full max-w-[1120px] px-ds-4 py-ds-5 md:px-ds-5">{children}</main>
    </>
  );
}
