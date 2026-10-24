import { DeleteProfileDialog } from "@/components/features/profile/DeleteProfileDialog";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CareerAnalysisBody, careerSubtitle } from "@/components/features/match/CareerAtAGlance";
import { ProfileSection, ProfileSections } from "@/components/features/profile/CollapsibleSections";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { formatMonthYear } from "@/lib/format";
import { profileStrength } from "@/server/ai";
import { requireProfile } from "@/server/auth/session";
import { locationOf } from "@/server/documents/model";
import { givenAnswers } from "@/server/domain/application-answers";
import { getStore } from "@/server/store";

export const metadata = { title: "Professional profile" };

const SKILL_GROUPS = [
  ["PROFESSIONAL", "Professional skills"],
  ["TECHNICAL", "Technical skills"],
  ["TOOL", "Tools"],
  ["DOMAIN", "Industry knowledge"],
  ["SOFT", "Soft skills"],
] as const;

/** Read view of the profile, with the career at a glance; editing happens at /profile/edit. */
export default async function ProfilePage() {
  const { user, profile: p } = await requireProfile();
  // The career reading is written with the profile (with the documents that start every application, which are not shown).
  const resume = await (await getStore()).resumeForJob(user.id, null);
  const career = resume?.versions.find((v) => v.id === resume.currentVersionId)?.content.analysis;
  const strength = profileStrength(p);
  const answers = givenAnswers(p.application);
  // Every section on the page in reading order (main column, then the side column). The first one starts open.
  const ids = [
    ...(career ? ["career"] : []),
    "summary",
    "experience",
    ...(p.projects.length ? ["projects"] : []),
    "skills",
    ...(answers.length ? ["application"] : []),
    ...(p.approvedFacts.length ? ["answers"] : []),
    "strength",
    "education",
    "certifications",
  ];

  return (
    <>
      <PageHeader
        title="Your professional profile"
        description="Your source of truth. Every tailored resume and cover letter is built from this — tailoring never changes it."
        actions={<ButtonLink href="/profile/edit">Update profile</ButtonLink>}
      />
      <ProfileSections ids={ids}>
        <div className="grid gap-ds-4 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-ds-4">
            <Card>
              <h2 className="text-heading-section">
                {p.firstName} {p.lastName}
              </h2>
              <p className="text-card-title text-blue-600">{p.headline}</p>
              <p className="text-body-sm mt-ds-2">{[p.email, p.phone, locationOf(p)].filter(Boolean).join(" · ")}</p>
            </Card>
            {career && (
              <ProfileSection id="career" title="Your career at a glance" subtitle={careerSubtitle(career)}>
                <CareerAnalysisBody analysis={career} />
              </ProfileSection>
            )}
            <ProfileSection id="summary" title="Professional summary">
              {p.summary ? <p className="text-body">{p.summary}</p> : <p className="text-body-sm">No summary yet. A short one makes a stronger resume.</p>}
            </ProfileSection>
            <ProfileSection id="experience" title="Work experience">
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
            </ProfileSection>
            {p.projects.length > 0 && (
              <ProfileSection id="projects" title="Projects">
                <ol className="flex flex-col gap-ds-4">
                  {p.projects.map((x) => (
                    <li key={x.id}>
                      <span className="text-label-bold">{x.name}</span>
                      {x.role && <span className="text-body-sm"> · {x.role}</span>}
                      {x.description && <p className="mt-ds-1 text-body-sm">{x.description}</p>}
                      {x.results && (
                        <p className="mt-ds-1 text-body-sm">
                          <span className="text-label-bold">Results: </span>
                          {x.results}
                        </p>
                      )}
                      {x.tools.length > 0 && <p className="mt-ds-1 text-caption">Tools: {x.tools.join(", ")}</p>}
                    </li>
                  ))}
                </ol>
              </ProfileSection>
            )}
            <ProfileSection id="skills" title="Skills">
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
            </ProfileSection>
            {answers.length > 0 && (
              <ProfileSection
                id="application"
                title="Voluntary self-identification"
                subtitle="Private. Never in your documents and never sent to the AI. Copy them into forms when you apply."
              >
                <dl className="flex flex-col gap-ds-2">
                  {answers.map((a) => (
                    <div
                      key={a.key}
                      className="flex flex-col gap-0.5 rounded-md bg-gray-100 px-ds-3 py-ds-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-ds-4"
                    >
                      <dt className="text-body-sm">{a.question}</dt>
                      <dd className="text-label-bold sm:text-right">{a.answer}</dd>
                    </div>
                  ))}
                </dl>
              </ProfileSection>
            )}
            {p.approvedFacts.length > 0 && (
              <ProfileSection
                id="answers"
                title="Your answers"
                subtitle="From job-match questions. Yes answers can be used in tailored resumes. Change them with Update profile."
              >
                <ul className="flex flex-col gap-ds-2 text-body-sm">
                  {p.approvedFacts.map((f) => (
                    <li key={f.id}>
                      <Badge tone={f.status === "APPROVED" ? "success" : "neutral"}>{f.status === "APPROVED" ? "Yes" : "No"}</Badge> {f.topic}
                      {f.answer ? ` — ${f.answer}` : ""}
                    </li>
                  ))}
                </ul>
              </ProfileSection>
            )}
          </div>
          <aside className="flex flex-col gap-ds-4">
            <ProfileSection id="strength" title="Profile strength">
              <ScoreBar label="Complete" value={strength.score} />
              {strength.nextSteps.length > 0 && (
                <ul className="mt-ds-3 list-disc pl-5 text-body-sm">
                  {strength.nextSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </ProfileSection>
            <ProfileSection id="education" title="Education">
              {p.education.map((e) => (
                <p key={e.id} className="text-body-sm">
                  <strong>{[e.degree, e.field].filter(Boolean).join(", ")}</strong>
                  <br />
                  {e.school}
                </p>
              ))}
            </ProfileSection>
            <ProfileSection id="certifications" title="Certifications">
              {p.certifications.map((c) => (
                <p key={c.id} className="text-body-sm">
                  <strong>{c.name}</strong> · {c.issuer}
                </p>
              ))}
            </ProfileSection>
          </aside>
        </div>
        <div className="mt-ds-5">
          <DeleteProfileDialog />
        </div>
      </ProfileSections>
    </>
  );
}
