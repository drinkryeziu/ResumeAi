"use client";

import { createContext, useActionState, useContext, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Check, CircleAlert, CircleDashed, Plus, Trash2, X } from "lucide-react";
import { saveProfile } from "@/app/(app)/profile/actions";
import { Badge } from "@/components/ui/Badge";
import { BusyOverlay } from "@/components/ui/BusyOverlay";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { errorProps, Field, Input, Textarea } from "@/components/ui/Field";
import { MonthField } from "@/components/ui/MonthField";
import { cn } from "@/lib/cn";
import type { ProfileInput } from "@/server/domain/profile-schema";
import { isStartedField, issuesForStep, profileProgress, SECTIONS, SETUP_STEPS, type ProfileIssue, type SectionId, type SectionStatus } from "./profile-progress";
import { ReviewStep } from "./ReviewStep";
import { SetupSteps } from "./SetupSteps";

type Exp = ProfileInput["experiences"][number];
type Edu = ProfileInput["education"][number];
type Cert = ProfileInput["certifications"][number];
type Proj = ProfileInput["projects"][number];

const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const blankExp = (): Exp => ({
  id: newId("exp"),
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  responsibilities: [],
  achievements: [],
  tools: [],
});
const blankEdu = (): Edu => ({ id: newId("edu"), school: "", degree: "", field: "", startDate: "", endDate: "", description: "" });
const blankCert = (): Cert => ({ id: newId("cert"), name: "", issuer: "", issueDate: "", expiryDate: "", credentialId: "", url: "" });
const blankProj = (): Proj => ({ id: newId("proj"), name: "", description: "", role: "", tools: [], results: "" });

// Lists are edited as text: one item per line, or comma-separated for skills and tools.
const toLines = (a: string[]) => a.join("\n");
const fromLines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const toCsv = (a: string[]) => a.join(", ");
const fromCsv = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/** `errors` holds the fields to mark red: all of them once the person has tried to continue, and before that the missing fields of entries they have already started. */
const ErrorsContext = createContext<{ errors: Map<string, string>; wizard: boolean }>({ errors: new Map(), wizard: false });

/** Scroll to a field (or its section) and focus it. */
function jumpTo(field: string, section: SectionId) {
  const el = document.querySelector<HTMLElement>(`[data-field="${field}"]`) ?? document.getElementById(section);
  el?.scrollIntoView({ block: "center" });
  el?.focus({ preventScroll: true });
}

/** `intro` (first-time setup only) shows above the fields on the first step, outside the form, e.g. the "import your CV" options. */
export function ProfileEditor({
  initial,
  baseline,
  firstTime,
  requestId,
  intro,
}: {
  initial: ProfileInput;
  /** What is saved right now. When `initial` already holds an unsaved CV import, Save must stay available. Defaults to `initial`. */
  baseline?: ProfileInput;
  firstTime: boolean;
  requestId: string;
  intro?: ReactNode;
}) {
  const [p, setP] = useState<ProfileInput>(() => (initial.experiences.length ? initial : { ...initial, experiences: [blankExp()] }));
  const [state, action] = useActionState(saveProfile, undefined);
  const savedJson = useRef(JSON.stringify(baseline ?? initial));
  const [attempted, setAttempted] = useState(false);
  const progress = useMemo(() => profileProgress(p), [p]);
  // Saving with nothing changed would only repeat the last save; later edits (not first-time setup) wait for a change.
  const changed = useMemo(() => JSON.stringify(p) !== savedJson.current, [p]);
  const first = progress.issues[0];
  const sec = (id: SectionId) => progress.sections[id];
  // Red marks: everything once the person has tried to continue; before that only the gaps in entries they have already started.
  const markedErrors = useMemo(() => {
    if (attempted) return progress.errors;
    return new Map([...progress.errors].filter(([field]) => isStartedField(p, field)));
  }, [attempted, progress.errors, p]);

  // First-time setup runs as steps; later edits use the single-page editor.
  const wizard = firstTime;
  const [step, setStep] = useState(0);
  const lastStep = SETUP_STEPS.length - 1;
  const stepIssues = wizard ? issuesForStep(progress, step) : progress.issues;
  const stepFirst = stepIssues[0];
  // Required fields gate the button: a step can't be left, and the last step can't be saved, while anything is missing.
  const blocked = wizard && step < lastStep ? !!stepFirst : !!first;
  const inStep = (id: SectionId) => !wizard || (SETUP_STEPS[step]!.sections as readonly SectionId[]).includes(id);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, [step]);
  const go = (to: number) => {
    moved.current = true;
    setAttempted(false);
    setStep(to);
  };

  // Saving with required items missing would only bounce back from the server one error at a time: show them all instead.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (wizard && step < lastStep) {
      e.preventDefault(); // Enter in a field means "Continue", never "Create"
      if (stepFirst) {
        setAttempted(true);
        jumpTo(stepFirst.field, stepFirst.section);
      } else go(step + 1);
      return;
    }
    if (!first) return;
    e.preventDefault();
    setAttempted(true);
    jumpTo(first.field, first.section);
  };
  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) => setP((x) => ({ ...x, [k]: v }));
  const setItem = <K extends "experiences" | "education" | "certifications" | "projects">(k: K, i: number, patch: Partial<ProfileInput[K][number]>) =>
    setP((x) => ({ ...x, [k]: (x[k] as Array<ProfileInput[K][number]>).map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const remove = (k: "experiences" | "education" | "certifications" | "projects", i: number) => setP((x) => ({ ...x, [k]: (x[k] as unknown[]).filter((_, j) => j !== i) }));

  return (
    <ErrorsContext.Provider value={{ errors: markedErrors, wizard }}>
      {wizard && (
        <div className="mb-ds-4 flex flex-col gap-ds-4">
          <SetupSteps current={step} />
          <div>
            <p className="text-caption">
              Step {step + 1} of {SETUP_STEPS.length}
            </p>
            <h2 ref={headingRef} tabIndex={-1} className="text-heading-section outline-none">
              {step === lastStep ? "Review your details" : SETUP_STEPS[step]!.label}
            </h2>
          </div>
          {/* Outside the form on purpose: the CV options are forms themselves, and forms can't nest. */}
          {step === 0 && intro}
        </div>
      )}
      <form action={action} onSubmit={onSubmit} noValidate className={cn("grid gap-ds-4", !wizard && "lg:grid-cols-[232px_1fr]")}>
        <SaveBusy wizard={wizard} />
        <input type="hidden" name="profile" value={JSON.stringify(p)} />
        <input type="hidden" name="requestId" value={requestId} />

        {!wizard && (
          <nav aria-label="Profile sections" className="hidden lg:block">
            <div className="flex flex-col gap-ds-3">
              <Progress done={progress.completeCount} total={SECTIONS.length} />
              <ol className="flex flex-col gap-1">
                {SECTIONS.map(([id, label]) => (
                  <li key={id}>
                    <a href={`#${id}`} className="flex items-start gap-ds-2 rounded-sm px-ds-2 py-1 text-body-sm no-underline hover:bg-sky-50 hover:text-blue-700">
                      <span className="mt-0.5">
                        <StatusIcon status={sec(id).status} />
                      </span>
                      <span className="flex flex-1 flex-col">
                        {label}
                        <span className={cn("text-caption", sec(id).status === "attention" ? "font-bold text-warning" : "sr-only")}>
                          <span className="sr-only">: </span>
                          {STATUS_LABEL[sec(id).status]}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
        )}

        <div className="flex flex-col gap-ds-4">
          {step === lastStep && wizard && <ReviewStep p={p} />}
          <StepPane show={inStep("personal")}>
            <Section id="personal" {...sec("personal")} title="Personal information">
              <Grid>
                <F label="First name" field="firstName" required value={p.firstName} onChange={(v) => set("firstName", v)} />
                <F label="Last name" field="lastName" required value={p.lastName} onChange={(v) => set("lastName", v)} />
                <F label="Professional title" field="headline" required value={p.headline} onChange={(v) => set("headline", v)} placeholder="e.g. Senior Product Designer" />
                <F label="Email" field="email" required type="email" value={p.email} onChange={(v) => set("email", v)} />
                <F label="Phone" value={p.phone ?? ""} onChange={(v) => set("phone", v)} />
                <F label="City" value={p.city ?? ""} onChange={(v) => set("city", v)} />
                <F label="State / region" value={p.state ?? ""} onChange={(v) => set("state", v)} />
                <F label="Country" value={p.country ?? ""} onChange={(v) => set("country", v)} />
              </Grid>
            </Section>
          </StepPane>

          <StepPane show={inStep("links")}>
            <Section id="links" {...sec("links")} title="Professional links">
              <Grid>
                {(["linkedin", "portfolio", "github", "behance", "dribbble", "website"] as const).map((k) => (
                  <F
                    key={k}
                    field={`links.${k}`}
                    label={{ linkedin: "LinkedIn", portfolio: "Portfolio", github: "GitHub", behance: "Behance", dribbble: "Dribbble", website: "Personal website" }[k]}
                    type="url"
                    placeholder="https://"
                    value={p.links[k] ?? ""}
                    onChange={(v) => set("links", { ...p.links, [k]: v })}
                  />
                ))}
              </Grid>
            </Section>
          </StepPane>

          <StepPane show={inStep("summary")}>
            <Section
              id="summary"
              {...sec("summary")}
              title="Professional summary"
              subtitle="3–4 sentences about what you do and what you're best at. We'll polish it for your Master Resume."
            >
              <Textarea aria-label="Professional summary" className="min-h-32" value={p.summary ?? ""} onChange={(e) => set("summary", e.target.value)} />
            </Section>
          </StepPane>

          <StepPane show={inStep("experience")}>
            <Section
              id="experience"
              {...sec("experience")}
              title="Work experience"
              subtitle="Most recent first. Achievements with real numbers make the strongest resumes — we never invent them."
            >
              {p.experiences.map((e, i) => (
                <Item
                  key={e.id}
                  title={e.title || e.company ? `${e.title || "Role"}${e.company ? `, ${e.company}` : ""}` : `Job ${i + 1}`}
                  onRemove={() => remove("experiences", i)}
                >
                  <Grid>
                    <F label="Company" field={`experiences.${i}.company`} required value={e.company} onChange={(v) => setItem("experiences", i, { company: v })} />
                    <F label="Job title" field={`experiences.${i}.title`} required value={e.title} onChange={(v) => setItem("experiences", i, { title: v })} />
                    <F label="Location" value={e.location ?? ""} onChange={(v) => setItem("experiences", i, { location: v })} />
                    <div />
                    <F
                      label="Start month"
                      field={`experiences.${i}.startDate`}
                      required
                      type="month"
                      value={e.startDate}
                      onChange={(v) => setItem("experiences", i, { startDate: v })}
                    />
                    {e.isCurrent ? (
                      <div />
                    ) : (
                      <F
                        label="End month"
                        field={`experiences.${i}.endDate`}
                        required
                        type="month"
                        value={e.endDate ?? ""}
                        onChange={(v) => setItem("experiences", i, { endDate: v })}
                      />
                    )}
                  </Grid>
                  <label className="flex items-center gap-ds-2 text-body-sm">
                    <input
                      type="checkbox"
                      checked={e.isCurrent}
                      onChange={(ev) => setItem("experiences", i, { isCurrent: ev.target.checked })}
                      className="size-4 accent-[var(--blue-600)]"
                    />
                    I currently work here
                  </label>
                  <TA
                    label="Responsibilities"
                    hint="One per line."
                    value={toLines(e.responsibilities)}
                    onChange={(v) => setItem("experiences", i, { responsibilities: fromLines(v) })}
                  />
                  <TA
                    label="Achievements"
                    hint="One per line — include results and numbers where you have them."
                    value={toLines(e.achievements)}
                    onChange={(v) => setItem("experiences", i, { achievements: fromLines(v) })}
                  />
                  <CSV label="Technologies and tools" hint="Separate with commas." value={e.tools} onChange={(v) => setItem("experiences", i, { tools: v })} />
                </Item>
              ))}
              <AddButton onClick={() => set("experiences", [...p.experiences, blankExp()])}>Add a job</AddButton>
            </Section>
          </StepPane>

          <StepPane show={inStep("education")}>
            <Section id="education" {...sec("education")} title="Education">
              {p.education.map((e, i) => (
                <Item key={e.id} title={e.school || `Education ${i + 1}`} onRemove={() => remove("education", i)}>
                  <Grid>
                    <F label="School or university" field={`education.${i}.school`} required value={e.school} onChange={(v) => setItem("education", i, { school: v })} />
                    <F label="Degree" value={e.degree ?? ""} onChange={(v) => setItem("education", i, { degree: v })} placeholder="e.g. B.A." />
                    <F label="Field of study" value={e.field ?? ""} onChange={(v) => setItem("education", i, { field: v })} />
                    <div />
                    <F label="Start month" type="month" value={e.startDate ?? ""} onChange={(v) => setItem("education", i, { startDate: v })} />
                    <F label="End month" type="month" value={e.endDate ?? ""} onChange={(v) => setItem("education", i, { endDate: v })} />
                  </Grid>
                  <TA label="Description" value={e.description ?? ""} onChange={(v) => setItem("education", i, { description: v })} />
                </Item>
              ))}
              <AddButton onClick={() => set("education", [...p.education, blankEdu()])}>Add education</AddButton>
            </Section>
          </StepPane>

          <StepPane show={inStep("skills")}>
            <Section id="skills" {...sec("skills")} title="Skills" subtitle="Separate with commas. Only list what you'd be comfortable discussing in an interview.">
              {(
                [
                  ["PROFESSIONAL", "Professional skills", "User research, Prototyping"],
                  ["TECHNICAL", "Technical skills", "HTML, CSS, SQL"],
                  ["TOOL", "Tools", "Figma, Jira"],
                  ["DOMAIN", "Industry knowledge", "Financial services, SaaS"],
                  ["SOFT", "Soft skills", "Communication, Mentoring"],
                ] as const
              ).map(([k, label, ph]) => (
                <CSV key={k} label={label} placeholder={ph} value={p.skills[k]} onChange={(v) => set("skills", { ...p.skills, [k]: v })} />
              ))}
            </Section>
          </StepPane>

          <StepPane show={inStep("certifications")}>
            <Section id="certifications" {...sec("certifications")} title="Certifications">
              {p.certifications.map((c, i) => (
                <Item key={c.id} title={c.name || `Certification ${i + 1}`} onRemove={() => remove("certifications", i)}>
                  <Grid>
                    <F label="Certification" field={`certifications.${i}.name`} required value={c.name} onChange={(v) => setItem("certifications", i, { name: v })} />
                    <F label="Issuing organization" value={c.issuer ?? ""} onChange={(v) => setItem("certifications", i, { issuer: v })} />
                    <F label="Issue month" type="month" value={c.issueDate ?? ""} onChange={(v) => setItem("certifications", i, { issueDate: v })} />
                    <F label="Expiration month" type="month" value={c.expiryDate ?? ""} onChange={(v) => setItem("certifications", i, { expiryDate: v })} />
                    <F label="Credential ID" value={c.credentialId ?? ""} onChange={(v) => setItem("certifications", i, { credentialId: v })} />
                    <F label="Credential URL" type="url" value={c.url ?? ""} onChange={(v) => setItem("certifications", i, { url: v })} />
                  </Grid>
                </Item>
              ))}
              <AddButton onClick={() => set("certifications", [...p.certifications, blankCert()])}>Add certification</AddButton>
            </Section>
          </StepPane>

          <StepPane show={inStep("projects")}>
            <Section id="projects" {...sec("projects")} title="Projects">
              {p.projects.map((x, i) => (
                <Item key={x.id} title={x.name || `Project ${i + 1}`} onRemove={() => remove("projects", i)}>
                  <Grid>
                    <F label="Project name" field={`projects.${i}.name`} required value={x.name} onChange={(v) => setItem("projects", i, { name: v })} />
                    <F label="Your role" value={x.role ?? ""} onChange={(v) => setItem("projects", i, { role: v })} />
                  </Grid>
                  <TA label="Description" value={x.description ?? ""} onChange={(v) => setItem("projects", i, { description: v })} />
                  <CSV label="Technologies and tools" hint="Separate with commas." value={x.tools} onChange={(v) => setItem("projects", i, { tools: v })} />
                  <TA label="Results" value={x.results ?? ""} onChange={(v) => setItem("projects", i, { results: v })} />
                </Item>
              ))}
              <AddButton onClick={() => set("projects", [...p.projects, blankProj()])}>Add project</AddButton>
            </Section>
          </StepPane>

          <StepPane show={inStep("additional")}>
            <Section id="additional" {...sec("additional")} title="Languages & more" subtitle="One per line.">
              <Grid>
                <TA
                  label="Languages"
                  hint="e.g. Spanish — professional working proficiency"
                  value={toLines(p.extras.LANGUAGE)}
                  onChange={(v) => set("extras", { ...p.extras, LANGUAGE: fromLines(v) })}
                />
                <TA label="Awards" value={toLines(p.extras.AWARD)} onChange={(v) => set("extras", { ...p.extras, AWARD: fromLines(v) })} />
                <TA label="Publications" value={toLines(p.extras.PUBLICATION)} onChange={(v) => set("extras", { ...p.extras, PUBLICATION: fromLines(v) })} />
                <TA label="Volunteer work" value={toLines(p.extras.VOLUNTEER)} onChange={(v) => set("extras", { ...p.extras, VOLUNTEER: fromLines(v) })} />
              </Grid>
            </Section>
          </StepPane>

          {/* Plain row at the end of the form. Continue / Save stay disabled until every required field (*) is filled. */}
          <div className={cn("flex gap-ds-4", wizard ? "flex-wrap items-center justify-between" : "flex-col")}>
            <div className="flex max-w-md flex-col gap-ds-2">
              {wizard ? (
                step === lastStep && <p className="text-body-sm">Creating your documents is free. We only use what you entered here.</p>
              ) : (
                <p className="text-body-sm">Saving also updates your Master Resume and Cover Letter. Resumes you already tailored to jobs keep their saved versions.</p>
              )}
            </div>
            <div className={cn("flex w-full flex-wrap items-center gap-ds-4", wizard && "sm:w-auto sm:justify-end")}>
              {wizard && step > 0 && (
                <button type="button" onClick={() => go(step - 1)} className="text-body-sm text-blue-700 underline">
                  Back
                </button>
              )}
              <div className={cn("flex flex-1 flex-col gap-ds-2", wizard ? "sm:flex-none sm:items-end" : "items-stretch")}>
                {wizard && step < lastStep ? (
                  <Button type="submit" className="w-full sm:w-auto" disabled={blocked} aria-describedby={blocked ? "required-hint" : undefined}>
                    Continue
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-ds-4 gap-y-ds-2">
                    <SaveButton label={wizard ? "Create my master documents" : "Save profile"} disabled={blocked || (!wizard && !changed)} long={!wizard} describedBy={blocked ? "required-hint" : undefined} />
                    {/* Nothing changed: there is nothing to save, so the way out is right beside the button. */}
                    {!wizard && !changed && (
                      <ButtonLink href="/profile" variant="link" icon={<X size={16} aria-hidden="true" />}>
                        Close without saving
                      </ButtonLink>
                    )}
                  </div>
                )}
                {blocked ? (
                  <p id="required-hint" className={cn("text-caption", !wizard && "text-center")}>
                    Fill in the fields marked * to {wizard && step < lastStep ? "continue" : "save"}.
                  </p>
                ) : (
                  !wizard && !changed && <p className="text-caption text-center">Make a change to save.</p>
                )}
                {state?.error && (
                  <p role="alert" className="text-body-sm text-danger">
                    {state.error}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </ErrorsContext.Provider>
  );
}

/** Keeps every section mounted (so typed text is never lost) and shows only the current step's. */
function StepPane({ show, children }: { show: boolean; children: ReactNode }) {
  return <div hidden={!show}>{children}</div>;
}

/** Saving writes the Master documents with AI, which is a long wait worth a window. */
function SaveBusy({ wizard }: { wizard: boolean }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <BusyOverlay title={wizard ? "Creating your documents…" : "Updating your documents…"} />;
}

function SaveButton({ label, disabled, long, describedBy }: { label: string; disabled?: boolean; long?: boolean; describedBy?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-describedby={describedBy} className={long ? "min-w-[12rem] flex-1" : "w-full sm:w-auto"}>
      {pending ? (long ? "Saving and updating your documents…" : "Saving and creating your documents…") : label}
    </Button>
  );
}

const STATUS_LABEL: Record<SectionStatus, string> = { complete: "Complete", attention: "Needs attention", empty: "Not added" };

function StatusIcon({ status, size = 16 }: { status: SectionStatus; size?: number }) {
  if (status === "complete") return <Check size={size} className="shrink-0 text-success" aria-hidden="true" />;
  if (status === "attention") return <CircleAlert size={size} className="shrink-0 text-warning" aria-hidden="true" />;
  return <CircleDashed size={size} className="shrink-0 text-gray-500" aria-hidden="true" />;
}

function Progress({ done, total, onTint }: { done: number; total: number; onTint?: boolean }) {
  return (
    <div>
      <p className="text-label-bold">
        {done} of {total} sections complete
      </p>
      <div
        className={`mt-ds-1 h-2 overflow-hidden rounded-pill ${onTint ? "bg-white" : "bg-gray-100"}`}
        role="progressbar"
        aria-label="Profile sections complete"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div className="h-full rounded-pill bg-blue-600" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  subtitle,
  status,
  issues,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  status: SectionStatus;
  issues: ProfileIssue[];
  children: ReactNode;
}) {
  // Several empty fields in one job would repeat the same wording, so list each message once.
  // Gaps already marked red next to their field are not listed again.
  const { errors, wizard } = useContext(ErrorsContext);
  const todo = [...new Set(issues.filter((i) => !errors.has(i.field)).map((i) => i.message))];
  return (
    <Card id={id} tabIndex={-1} aria-labelledby={`${id}-h`} className="scroll-mt-[84px] outline-none">
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-x-ds-3 gap-y-ds-1">
            <span id={`${id}-h`}>{title}</span>
            {!wizard && (
              <Badge tone={status === "complete" ? "success" : status === "attention" ? "warning" : "neutral"}>
                <StatusIcon status={status} size={12} />
                {STATUS_LABEL[status]}
              </Badge>
            )}
          </span>
        }
        subtitle={subtitle}
      />
      {todo.length > 0 && (
        <ul className="mb-ds-4 flex list-disc flex-col gap-1 rounded-md bg-sky-50 py-ds-3 pr-ds-3 pl-[32px] text-body-sm">
          {todo.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-ds-4">{children}</div>
    </Card>
  );
}

function Item({ title, onRemove, children }: { title: string; onRemove: () => void; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-ds-4 rounded-md bg-sky-50 p-ds-4 [&_input:not([type=checkbox])]:bg-white [&_textarea]:bg-white">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center justify-between">
        <span className="text-label-bold">{title}</span>
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-body-sm text-blue-700 underline">
          <Trash2 size={14} aria-hidden="true" /> Remove
        </button>
      </div>
      {children}
    </fieldset>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="secondary" onClick={onClick} icon={<Plus size={14} aria-hidden="true" />} className="self-start">
      {children}
    </Button>
  );
}

const Grid = ({ children }: { children: ReactNode }) => <div className="grid gap-ds-4 md:grid-cols-2">{children}</div>;

function F({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  hint,
  field,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  hint?: string;
  /** Dotted path used to look up this field's error and to jump to it. */
  field?: string;
}) {
  const id = useId();
  const { errors } = useContext(ErrorsContext);
  const [badText, setBadText] = useState(false); // month fields only: typed text that isn't a month and year
  const error = badText ? "Enter a month and year, like Mar 2021." : field ? errors.get(field) : undefined;
  return (
    <Field label={label} htmlFor={id} required={required} hint={hint} error={error}>
      {type === "month" ? (
        <MonthField id={id} value={value} onChange={onChange} onBadText={setBadText} data-field={field} aria-required={required || undefined} {...errorProps(id, error)} />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          data-field={field}
          aria-required={required || undefined}
          onChange={(e) => onChange(e.target.value)}
          {...errorProps(id, error)}
        />
      )}
    </Field>
  );
}

/** Comma-separated list input that keeps the raw text while typing (so "Figma, " isn't trimmed mid-word). */
function CSV({ label, value, onChange, placeholder, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; hint?: string }) {
  const id = useId();
  const [draft, setDraft] = useState(toCsv(value));
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(fromCsv(e.target.value));
        }}
      />
    </Field>
  );
}

function TA({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const id = useId();
  // Keep the raw text while typing so blank lines and trailing commas don't vanish mid-edit.
  const [draft, setDraft] = useState(value);
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Textarea
        id={id}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        className="min-h-24"
      />
    </Field>
  );
}
