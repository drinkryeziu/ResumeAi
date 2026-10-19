import { redirect } from "next/navigation";
import { AuthShell } from "@/components/features/auth/AuthShell";
import { SignInForm } from "@/components/features/auth/AuthForms";
import { signedInUserId } from "@/server/auth/session";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  if (await signedInUserId()) redirect("/dashboard");
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to tailor your next application.">
      {(await searchParams).reset === "1" && (
        <p role="status" className="rounded-md bg-sky-50 p-ds-3 text-body-sm text-success">
          Your password was changed. Sign in with the new one.
        </p>
      )}
      <SignInForm />
    </AuthShell>
  );
}
