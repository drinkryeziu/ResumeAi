import Link from "next/link";
import { Download } from "lucide-react";
import { DeleteAccountDialog } from "@/components/features/account/DeleteAccountDialog";
import { ButtonAnchor } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/server/auth/session";
import { getStore } from "@/server/store";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const account = await (await getStore()).getUser(user.id);
  return (
    <>
      <PageHeader title="Settings" description="Your account and your data." />
      <div className="flex max-w-2xl flex-col gap-ds-4">
        <Card>
          <CardHeader title="Account" />
          <dl className="grid grid-cols-[auto_1fr] gap-x-ds-4 gap-y-ds-2 text-body-sm">
            <dt className="text-label-bold">Name</dt>
            <dd>{account?.name}</dd>
            <dt className="text-label-bold">Email</dt>
            <dd className="break-all">{user.email}</dd>
          </dl>
          <p className="text-body-sm mt-ds-3">
            The details on your resumes come from your{" "}
            <Link href="/profile" className="text-blue-700 underline">
              profile
            </Link>
            .
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Your data"
            subtitle="Everything we hold about you, as one file you can keep: your profile, every resume and cover letter with its versions, your applications and your credit history."
          />
          <ButtonAnchor href="/api/account/export" variant="secondary" icon={<Download size={16} aria-hidden="true" />}>
            Download my data
          </ButtonAnchor>
        </Card>

        <Card>
          <CardHeader title="Delete your account" subtitle="Removes your account and everything in it, right away. This can't be undone." />
          <DeleteAccountDialog email={user.email} />
        </Card>
      </div>
    </>
  );
}
