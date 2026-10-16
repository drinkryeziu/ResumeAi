"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileUp, Loader2 } from "lucide-react";
import { importCv } from "@/app/(app)/profile/actions";
import { Button } from "@/components/ui/Button";

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} icon={pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <FileUp size={14} aria-hidden="true" />}>
      {pending ? "Reading your CV…" : "Upload CV"}
    </Button>
  );
}

/** "Already have a CV?" — upload it to pre-fill the profile form instead of typing everything. */
export function CvImport({ returnTo, requestId, compact }: { returnTo: "onboarding" | "edit"; requestId: string; compact?: boolean }) {
  const [state, action] = useActionState(importCv, undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <form action={action} className="flex flex-col gap-ds-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="requestId" value={requestId} />
      <div className="flex flex-wrap items-center gap-ds-4">
        <label className="flex min-w-64 flex-1 cursor-pointer items-center gap-ds-3 rounded-md border-2 border-dashed border-[#c9d3e3] bg-white px-ds-4 py-ds-3 hover:border-blue-600">
          <FileUp size={24} className="shrink-0 text-blue-600" aria-hidden="true" />
          <span className="flex flex-col">
            <span className="text-label-bold">{fileName ?? (compact ? "Choose a CV file" : "Choose your CV")}</span>
            <span className="text-caption">PDF or Word (.docx), up to 5 MB</span>
          </span>
          <input
            type="file"
            name="cv"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        <Submit disabled={!fileName} />
      </div>
      {state?.error && (
        <p role="alert" className="text-body-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
