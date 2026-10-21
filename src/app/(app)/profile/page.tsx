import { PenLine } from "lucide-react";
import { DeleteProfileDialog } from "@/components/features/profile/DeleteProfileDialog";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { formatMonthYear } from "@/lib/format";
import { profileStrength } from "@/server/ai";
import { requireProfile } from "@/server/auth/session";
import { locationOf } from "@/server/documents/model";

export const metadata = { title: "Profile" };

const SKILL_GROUPS = [
  ["PROFESSIONAL", "Professional skills"],
  ["TECHNICAL", "Technical skills"],
  ["TOOL", "Tools"],
  ["DOMAIN", "Industry knowledge"],
  ["SOFT", "Soft skills"],
] as const;

/** Opens the editor at one section. The visible label stays "Edit"; the aria-label says which section. */
function EditLink({ section, label }: { section: string; label: string }) {
  return (
    <ButtonLink href={`/profile/edit#${section}`} variant="secondary" compact icon={<PenLine size={16} aria-hidden="true" />} aria-label={label}>
      Edit
    </ButtonLink>
  );
}

/** Read view of the Master Profile; editing happens at /profile/edit. */
export default async function ProfilePage() {
  const { profile: p } = await requireProfile();
  const strength = profileStrength(p);

  return (
    <>
      <PageHeader
        title="Your professional profile"
        description="Your master source of truth. Every tailored resume and cover letter is built from this — tailoring never changes it."
        actions={
          <>
            <ButtonLink href="/master" variant="link">
              View Master Resume
            </ButtonLink>
            <ButtonLink href="/profile/edit">Update profile</ButtonLink>
          </>
        }
      />
      <div className="grid gap-ds-4 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-ds-4">
          <Card>
            <h2 className="text-heading-section">
              {p.firstName} {p.lastName}
            </h2>
            <p className="text-card-title text-blue-600">{p.headline}</p>
            <p className="text-body-sm mt-ds-2">{[p.email, p.phone, locationOf(p)].filter(Boolean).join(" · ")}</p>
          </Card>
          <Card aria-labelledby="summary-h">
            <CardHeader title={<span id="summary-h">Professional summary</span>} action={<EditLink section="summary" label="Edit professional summary" />} />
            {p.summary ? <p className="text-body">{p.summary}</p> : <p className="text-body-sm">No summary yet. A short one makes a stronger resume.</p>}
          </Card>
          <Card>
            <CardHeader title="Work experience" />
            <ol className="flex flex-col gap-ds-4">
              {p.experiences.map((e) => (
                <li key={e.id}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-label-bold">
                      {e.title} · {e.company}
                    </span>
                    <span className="text-body-sm">
                      {formatMonthYear(e.startDate)} – {e.isCurrent ? "Present" : formatMonthYear(e.endDate)}
                    </span>
                  </div>
                  <ul className="mt-ds-2 list-disc pl-5 text-body-sm">
                    {[...e.achievements, ...e.responsibilities].map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  {e.tools.length > 0 && <p className="text-caption mt-ds-1">Tools: {e.tools.join(", ")}</p>}
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardHeader title="Skills" action={<EditLink section="skills" label="Edit skills" />} />
            <div className="flex flex-col gap-ds-3">
              {SKILL_GROUPS.map(([cat, title]) => {
                const items = p.skills.filter((s) => s.category === cat);
                return items.length ? (
                  <div key={cat}>
                    <h3 className="text-label-bold mb-ds-2">{title}</h3>
                    <ul className="flex flex-wrap gap-ds-2">
                      {items.map((s) => (
                        <li key={s.id}>
                          <Badge>{s.name}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null;
              })}
            </div>
          </Card>
          {p.approvedFacts.length > 0 && (
            <Card>
              <CardHeader title="Your answers" subtitle="From job-match questions. Yes answers can be used in tailored resumes." />
              <ul className="flex flex-col gap-ds-2 text-body-sm">
                {p.approvedFacts.map((f) => (
                  <li key={f.id}>
                    <Badge tone={f.status === "APPROVED" ? "success" : "neutral"}>{f.status === "APPROVED" ? "Yes" : "No"}</Badge> {f.topic}
                    {f.answer ? ` — ${f.answer}` : ""}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <aside className="flex flex-col gap-ds-4">
          <Card>
            <CardHeader title="Profile strength" />
            <ScoreBar label="Complete" value={strength.score} />
            {strength.nextSteps.length > 0 && (
              <ul className="mt-ds-3 list-disc pl-5 text-body-sm">
                {strength.nextSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Education" />
            {p.education.map((e) => (
              <p key={e.id} className="text-body-sm">
                <strong>{[e.degree, e.field].filter(Boolean).join(", ")}</strong>
                <br />
                {e.school}
              </p>
            ))}
          </Card>
          <Card>
            <CardHeader title="Certifications" />
            {p.certifications.map((c) => (
              <p key={c.id} className="text-body-sm">
                <strong>{c.name}</strong> · {c.issuer}
              </p>
            ))}
          </Card>
        </aside>
      </div>
      <Card className="mt-ds-4">
        <CardHeader title="Delete your profile" subtitle="Removes your profile and Master documents so you can start again with a new one. This can't be undone." />
        <DeleteProfileDialog />
      </Card>
    </>
  );
}
