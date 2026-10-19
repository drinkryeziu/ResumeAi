import { AuthShell } from "@/components/features/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/features/auth/AuthForms";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send you a link to choose a new one.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
