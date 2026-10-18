import { CheckCircle2 } from "lucide-react";
import { discardCvImport } from "@/app/(app)/profile/actions";
import type { ImportSummary } from "@/server/domain/profile-mapping";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Shown after a CV upload: what was found, and that nothing is saved until the user reviews and saves. */
export function ImportBanner({ fileName, added, returnTo }: { fileName: string; added: ImportSummary; returnTo: "onboarding" | "edit" }) {
  const found = [
    added.experiences && plural(added.experiences, "job", "jobs"),
    added.education && plural(added.education, "education entry", "education entries"),
    added.skills && plural(added.skills, "skill", "skills"),
    added.certifications && plural(added.certifications, "certification", "certifications"),
    added.projects && plural(added.projects, "project", "projects"),
  ].filter(Boolean);
  return (
    <div role="status" className="mb-ds-4 flex flex-wrap items-start justify-between gap-ds-4 rounded-md bg-sky-50 p-ds-4">
      <div className="flex gap-ds-3">
        <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
        <div className="flex flex-col gap-ds-1">
          <p className="text-label-bold text-success">We filled in your profile from {fileName}</p>
          <p className="text-body-sm">
            {found.length ? `Added ${found.join(", ")}.` : "Your profile already had everything we found."} Check every field below — especially dates — and fix anything we
            read wrong. <strong>Nothing is saved until you save your profile.</strong>
          </p>
          {added.missingStart.length > 0 && (
            <p className="text-body-sm text-warning">
              Your CV only shows the year for: <strong>{added.missingStart.join("; ")}</strong>. Add the start month under Work experience — we don&apos;t guess dates.
            </p>
          )}
        </div>
      </div>
      <form action={discardCvImport}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <button type="submit" className="text-body-sm text-blue-700 underline">
          Discard import
        </button>
      </form>
    </div>
  );
}
