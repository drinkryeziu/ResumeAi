import { redirect } from "next/navigation";
import { AuthShell } from "@/components/features/auth/AuthShell";
import { SignInForm } from "@/components/features/auth/AuthForms";
import { SoftPanel } from "@/components/ui/Card";
import { auth } from "@/server/auth/config";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/server/demo/fixtures";
import { demoAccountEnabled } from "@/server/store/config";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  if ((await auth())?.user?.id) redirect("/dashboard");
  const demoAvailable = demoAccountEnabled();
  const demo = demoAvailable && (await searchParams).demo === "1";
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to tailor your next application."
      footer={
        // Shown only while the demo account exists (the in-memory store, or MongoDB with MONGODB_SEED_DEMO=true).
        demoAvailable && (
          <SoftPanel className="bg-white text-body-sm shadow-card">
            <strong>Just exploring?</strong> Sign in with the demo account: <code>{DEMO_EMAIL}</code> / <code>{DEMO_PASSWORD}</code>.{" "}
            <a href="/sign-in?demo=1" className="text-blue-700 underline">
              Fill it in
            </a>
          </SoftPanel>
        )
      }
    >
      <SignInForm demo={demo ? { email: DEMO_EMAIL, password: DEMO_PASSWORD } : undefined} />
    </AuthShell>
  );
}
