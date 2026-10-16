import { SiteHeader } from "@/components/layout/SiteHeader";
import { requireUser } from "@/server/auth/session";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const balance = await (await getStore()).credits.balance(user.id);
  return (
    <>
      <SiteHeader creditBalance={balance} />
      <main className="mx-auto w-full max-w-[1120px] px-ds-4 py-ds-5 md:px-ds-5">{children}</main>
    </>
  );
}
