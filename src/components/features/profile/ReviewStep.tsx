import { Card, CardHeader, SoftPanel } from "@/components/ui/Card";
import type { ProfileInput } from "@/server/domain/profile-schema";

const hasText = (v: string | undefined) => Boolean(v?.trim());

/** Last setup step: what the master documents will be built from, plus a few optional ways to make them stronger. */
export function ReviewStep({ p }: { p: ProfileInput }) {
  const skills = Object.values(p.skills).flat().length;
  const contact = [p.email, p.phone, [p.city, p.state].filter(Boolean).join(", ")].filter(hasText).join(" · ");
  const rows: Array<[string, string]> = [
    ["Name", `${p.firstName} ${p.lastName}`.trim()],
    ["Professional title", p.headline],
    ["Contact", contact],
    ["Jobs", String(p.experiences.length)],
    ["Education", String(p.education.length)],
    ["Skills", String(skills)],
    ["Summary", hasText(p.summary) ? "Added" : "Not added"],
    ["Application questions", `${Object.values(p.application ?? {}).filter(hasText).length} answered (private, optional)`],
  ];
  const tips = [
    !hasText(p.summary) && "Write a short summary so your resume opens with who you are.",
    p.experiences.some((e) => e.achievements.length < 2) && "Add at least two achievements to each job, with real numbers where you have them.",
    skills < 8 && "List at least 8 skills.",
    !Object.values(p.links).some((v) => hasText(v)) && "Add a LinkedIn or portfolio link.",
    p.education.length === 0 && "Add your education.",
  ].filter((t): t is string => Boolean(t));

  return (
    <>
      <Card>
        <CardHeader title="What we'll build from" subtitle="Your profile, built only from these details." />
        <dl className="flex flex-col gap-ds-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-ds-4 text-body-sm">
              <dt>{label}</dt>
              <dd className="min-w-0 text-right font-bold [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {tips.length > 0 && (
        <SoftPanel className="flex flex-col gap-ds-2">
          <h3 className="text-label-bold">Make it stronger (optional)</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm">
            {tips.slice(0, 4).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="text-caption">Use Back to add more, or create your profile now and update it later.</p>
        </SoftPanel>
      )}
    </>
  );
}
