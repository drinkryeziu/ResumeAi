import Link from "next/link";
import { AuthShell } from "@/components/features/auth/AuthShell";
import { ResetPasswordForm } from "@/components/features/auth/AuthForms";
import { isResetTokenValid } from "@/server/auth/password-reset";
import { getStore } from "@/server/store";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const valid = await isResetTokenValid(await getStore(), token);
  if (!valid) {
    return (
      <AuthShell title="This link can't be used" subtitle="It has expired, or it was already used.">
        <Link href="/forgot-password" className="text-body-sm text-blue-700 underline">
          Ask for a new link
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" subtitle="Pick something at least 8 characters long.">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
