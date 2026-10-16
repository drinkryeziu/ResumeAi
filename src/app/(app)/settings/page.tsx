import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <ComingSoon title="Settings" description="Account, sign-in methods, default cover-letter tone, data export and account deletion." phase="phase 2 (with sign-in)">
      <p className="text-body-sm">You&apos;re using the demo account. Data resets when the server restarts.</p>
    </ComingSoon>
  );
}
