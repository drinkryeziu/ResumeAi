import { ButtonLink } from "@/components/ui/Button";
import { DeleteProfileDialog } from "@/components/features/profile/DeleteProfileDialog";
import { Badge } from "@/components/ui/Badge";
import { CareerAnalysisBody, careerSubtitle } from "@/components/features/match/CareerAtAGlance";
import { DIRECTIONS_SUBTITLE, JobDirectionsBody } from "@/components/features/match/JobDirections";
import { ProfileSection, ProfileSections } from "@/components/features/profile/CollapsibleSections";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { formatMonthYear } from "@/lib/format";
import { jobDirections, profileStrength } from "@/server/ai";
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
  const directions = jobDirections(career);
  const answers = givenAnswers(p.application);
  // Every section on the page in reading order (main column, then the side column). The first one starts open.
  const ids = [
    "strength",
    ...(directions.length ? ["directions"] : []),
    ...(career ? ["career"] : []),
    "summary",
    "experience",
    ...(p.projects.length ? ["projects"] : []),
    "education",
    "skills",
    "certifications",
    ...(answers.length ? ["application"] : []),
    ...(p.approvedFacts.length ? ["answers"] : []),
  ];

  return (
    <>
      <PageHeader
        title="Your professional profile"
        description="Your source of truth. Every tailored resume and cover letter is built from this — tailoring never changes it."
      />
      <ProfileSections ids={ids}>
        <div className="flex flex-col gap-ds-4">
          <Card>
            <h2 className="text-heading-section">
              {p.firstName} {p.lastName}
            </h2>
            <p className="text-card-title text-blue-600">{p.headline}</p>
            <p className="text-body-sm mt-ds-2">{[p.email, p.phone, locationOf(p)].filter(Boolean).join(" · ")}</p>
          </Card>
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
          {directions.length > 0 && (
            <ProfileSection id="directions" title="Jobs to look for" subtitle={DIRECTIONS_SUBTITLE}>
              <JobDirectionsBody rows={directions} />
            </ProfileSection>
          )}
          {career && (
            <ProfileSection id="career" tone="aurora" title="Your career at a glance" subtitle={careerSubtitle(career)}>
              <CareerAnalysisBody analysis={career} />
            </ProfileSection>
          )}
          <ProfileSection id="summary" editHref="/profile/edit#summary" title="Professional summary">
            {p.summary ? <p className="text-body">{p.summary}</p> : <p className="text-body-sm">No summary yet. A short one makes a stronger resume.</p>}
          </ProfileSection>
          <ProfileSection id="experience" editHref="/profile/edit#experience" title="Work experience">
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
            <ProfileSection id="projects" editHref="/profile/edit#projects" title="Projects">
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
          <ProfileSection id="education" editHref="/profile/edit#education" title="Education">
            {p.education.map((e) => (
              <p key={e.id} className="text-body-sm">
                <strong>{[e.degree, e.field].filter(Boolean).join(", ")}</strong>
                <br />
                {e.school}
              </p>
            ))}
          </ProfileSection>
          <ProfileSection id="skills" editHref="/profile/edit#skills" title="Skills">
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
          <ProfileSection id="certifications" editHref="/profile/edit#certifications" title="Certifications">
            {p.certifications.map((c) => (
              <p key={c.id} className="text-body-sm">
                <strong>{c.name}</strong> · {c.issuer}
              </p>
            ))}
          </ProfileSection>
          {answers.length > 0 && (
            <ProfileSection
              id="application"
              editHref="/profile/edit#application"
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
              editHref="/profile/edit#answers"
              title="Your answers"
              subtitle="From job-match questions. Yes answers can be used in tailored resumes. Change them with Edit."
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
        <div className="mt-ds-5">
          <DeleteProfileDialog />
        </div>
      </ProfileSections>
      {/* Stuck to the bottom of the screen while the page scrolls. The right side is left free for the Ask Drin button. */}
      <div className="sticky bottom-3 z-30 mt-ds-5 pr-[152px] sm:bottom-5 sm:pr-[176px]">
        <ButtonLink href="/dashboard#tailor" className="w-full text-center leading-tight shadow-[0_16px_36px_-10px_rgba(109,74,255,0.6)]">
          Tailor your resume to a job
        </ButtonLink>
      </div>
    </>
  );
}
