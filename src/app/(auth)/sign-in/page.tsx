import { redirect } from "next/navigation";
import { AuthShell } from "@/components/features/auth/AuthShell";
import { SignInForm } from "@/components/features/auth/AuthForms";
import { auth } from "@/server/auth/config";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  if ((await auth())?.user?.id) redirect("/dashboard");
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to tailor your next application.">
      <SignInForm />
    </AuthShell>
  );
}
