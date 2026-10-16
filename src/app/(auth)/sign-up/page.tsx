import { redirect } from "next/navigation";
import { AuthShell } from "@/components/features/auth/AuthShell";
import { SignUpForm } from "@/components/features/auth/AuthForms";
import { auth } from "@/server/auth/config";

export const metadata = { title: "Create your account" };

export default async function SignUpPage() {
  if ((await auth())?.user?.id) redirect("/dashboard");
  return (
    <AuthShell title="Create your account" subtitle="Free to start — includes enough credits for your first tailored application.">
      <SignUpForm />
    </AuthShell>
  );
}
