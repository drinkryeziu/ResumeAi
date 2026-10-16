"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { saveProfile } from "@/app/(app)/profile/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import type { ProfileInput } from "@/server/domain/profile-schema";

type Exp = ProfileInput["experiences"][number];
type Edu = ProfileInput["education"][number];
type Cert = ProfileInput["certifications"][number];
type Proj = ProfileInput["projects"][number];

const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const blankExp = (): Exp => ({ id: newId("exp"), company: "", title: "", location: "", startDate: "", endDate: "", isCurrent: false, responsibilities: [], achievements: [], tools: [] });
const blankEdu = (): Edu => ({ id: newId("edu"), school: "", degree: "", field: "", startDate: "", endDate: "", description: "" });
const blankCert = (): Cert => ({ id: newId("cert"), name: "", issuer: "", issueDate: "", expiryDate: "", credentialId: "", url: "" });
const blankProj = (): Proj => ({ id: newId("proj"), name: "", description: "", role: "", tools: [], results: "" });

// Lists are edited as text: one item per line, or comma-separated for skills and tools.
const toLines = (a: string[]) => a.join("\n");
const fromLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const toCsv = (a: string[]) => a.join(", ");
const fromCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

const SECTIONS = [
  ["personal", "Personal information"],
  ["links", "Professional links"],
  ["summary", "Summary"],
  ["experience", "Work experience"],
  ["education", "Education"],
  ["skills", "Skills"],
  ["certifications", "Certifications"],
  ["projects", "Projects"],
  ["additional", "Languages & more"],
] as const;

export function ProfileEditor({ initial, firstTime, requestId }: { initial: ProfileInput; firstTime: boolean; requestId: string }) {
  const [p, setP] = useState<ProfileInput>(() => (initial.experiences.length ? initial : { ...initial, experiences: [blankExp()] }));
  const [state, action] = useActionState(saveProfile, undefined);
  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) => setP((x) => ({ ...x, [k]: v }));
  const setItem = <K extends "experiences" | "education" | "certifications" | "projects">(k: K, i: number, patch: Partial<ProfileInput[K][number]>) =>
    setP((x) => ({ ...x, [k]: (x[k] as Array<ProfileInput[K][number]>).map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const remove = (k: "experiences" | "education" | "certifications" | "projects", i: number) => setP((x) => ({ ...x, [k]: (x[k] as unknown[]).filter((_, j) => j !== i) }));

  return (
    <form action={action} className="grid gap-ds-4 lg:grid-cols-[200px_1fr]">
      <input type="hidden" name="profile" value={JSON.stringify(p)} />
      <input type="hidden" name="requestId" value={requestId} />

      <nav aria-label="Profile sections" className="hidden lg:block">
        <ol className="sticky top-[84px] flex flex-col gap-ds-2">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-body-sm no-underline hover:text-blue-600">
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex flex-col gap-ds-4">
        <Section id="personal" title="Personal information">
          <Grid>
            <F label="First name" required value={p.firstName} onChange={(v) => set("firstName", v)} />
            <F label="Last name" required value={p.lastName} onChange={(v) => set("lastName", v)} />
            <F label="Professional title" required value={p.headline} onChange={(v) => set("headline", v)} placeholder="e.g. Senior Product Designer" />
            <F label="Email" required type="email" value={p.email} onChange={(v) => set("email", v)} />
            <F label="Phone" value={p.phone ?? ""} onChange={(v) => set("phone", v)} />
            <F label="City" value={p.city ?? ""} onChange={(v) => set("city", v)} />
            <F label="State / region" value={p.state ?? ""} onChange={(v) => set("state", v)} />
            <F label="Country" value={p.country ?? ""} onChange={(v) => set("country", v)} />
          </Grid>
        </Section>

        <Section id="links" title="Professional links">
          <Grid>
            {(["linkedin", "portfolio", "github", "behance", "dribbble", "website"] as const).map((k) => (
              <F
                key={k}
                label={{ linkedin: "LinkedIn", portfolio: "Portfolio", github: "GitHub", behance: "Behance", dribbble: "Dribbble", website: "Personal website" }[k]}
                type="url"
                placeholder="https://"
                value={p.links[k] ?? ""}
                onChange={(v) => set("links", { ...p.links, [k]: v })}
              />
            ))}
          </Grid>
        </Section>

        <Section id="summary" title="Professional summary" subtitle="3–4 sentences about what you do and what you're best at. We'll polish it for your Master Resume.">
          <Textarea aria-label="Professional summary" className="min-h-32" value={p.summary ?? ""} onChange={(e) => set("summary", e.target.value)} />
        </Section>

        <Section id="experience" title="Work experience" subtitle="Most recent first. Achievements with real numbers make the strongest resumes — we never invent them.">
          {p.experiences.map((e, i) => (
            <Item key={e.id} title={e.title || e.company ? `${e.title || "Role"}${e.company ? `, ${e.company}` : ""}` : `Job ${i + 1}`} onRemove={() => remove("experiences", i)}>
              <Grid>
                <F label="Company" required value={e.company} onChange={(v) => setItem("experiences", i, { company: v })} />
                <F label="Job title" required value={e.title} onChange={(v) => setItem("experiences", i, { title: v })} />
                <F label="Location" value={e.location ?? ""} onChange={(v) => setItem("experiences", i, { location: v })} />
                <div />
                <F label="Start month" required type="month" value={e.startDate} onChange={(v) => setItem("experiences", i, { startDate: v })} />
                {e.isCurrent ? (
                  <div />
                ) : (
                  <F label="End month" required type="month" value={e.endDate ?? ""} onChange={(v) => setItem("experiences", i, { endDate: v })} />
                )}
              </Grid>
              <label className="flex items-center gap-ds-2 text-body-sm">
                <input type="checkbox" checked={e.isCurrent} onChange={(ev) => setItem("experiences", i, { isCurrent: ev.target.checked })} className="size-4 accent-[var(--blue-600)]" />I currently work here
              </label>
              <TA label="Responsibilities" hint="One per line." value={toLines(e.responsibilities)} onChange={(v) => setItem("experiences", i, { responsibilities: fromLines(v) })} />
              <TA label="Achievements" hint="One per line — include results and numbers where you have them." value={toLines(e.achievements)} onChange={(v) => setItem("experiences", i, { achievements: fromLines(v) })} />
              <CSV label="Technologies and tools" hint="Separate with commas." value={e.tools} onChange={(v) => setItem("experiences", i, { tools: v })} />
            </Item>
          ))}
          <AddButton onClick={() => set("experiences", [...p.experiences, blankExp()])}>Add a job</AddButton>
        </Section>

        <Section id="education" title="Education">
          {p.education.map((e, i) => (
            <Item key={e.id} title={e.school || `Education ${i + 1}`} onRemove={() => remove("education", i)}>
              <Grid>
                <F label="School or university" required value={e.school} onChange={(v) => setItem("education", i, { school: v })} />
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

        <Section id="skills" title="Skills" subtitle="Separate with commas. Only list what you'd be comfortable discussing in an interview.">
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

        <Section id="certifications" title="Certifications">
          {p.certifications.map((c, i) => (
            <Item key={c.id} title={c.name || `Certification ${i + 1}`} onRemove={() => remove("certifications", i)}>
              <Grid>
                <F label="Certification" required value={c.name} onChange={(v) => setItem("certifications", i, { name: v })} />
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

        <Section id="projects" title="Projects">
          {p.projects.map((x, i) => (
            <Item key={x.id} title={x.name || `Project ${i + 1}`} onRemove={() => remove("projects", i)}>
              <Grid>
                <F label="Project name" required value={x.name} onChange={(v) => setItem("projects", i, { name: v })} />
                <F label="Your role" value={x.role ?? ""} onChange={(v) => setItem("projects", i, { role: v })} />
              </Grid>
              <TA label="Description" value={x.description ?? ""} onChange={(v) => setItem("projects", i, { description: v })} />
              <CSV label="Technologies and tools" hint="Separate with commas." value={x.tools} onChange={(v) => setItem("projects", i, { tools: v })} />
              <TA label="Results" value={x.results ?? ""} onChange={(v) => setItem("projects", i, { results: v })} />
            </Item>
          ))}
          <AddButton onClick={() => set("projects", [...p.projects, blankProj()])}>Add project</AddButton>
        </Section>

        <Section id="additional" title="Languages & more" subtitle="One per line.">
          <Grid>
            <TA label="Languages" hint="e.g. Spanish — professional working proficiency" value={toLines(p.extras.LANGUAGE)} onChange={(v) => set("extras", { ...p.extras, LANGUAGE: fromLines(v) })} />
            <TA label="Awards" value={toLines(p.extras.AWARD)} onChange={(v) => set("extras", { ...p.extras, AWARD: fromLines(v) })} />
            <TA label="Publications" value={toLines(p.extras.PUBLICATION)} onChange={(v) => set("extras", { ...p.extras, PUBLICATION: fromLines(v) })} />
            <TA label="Volunteer work" value={toLines(p.extras.VOLUNTEER)} onChange={(v) => set("extras", { ...p.extras, VOLUNTEER: fromLines(v) })} />
          </Grid>
        </Section>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-ds-4 rounded-md bg-white p-ds-4 shadow-card">
          {firstTime ? (
            <p className="text-body-sm max-w-md">When you save, we&apos;ll create your Master Resume and Master Cover Letter from this profile.</p>
          ) : (
            <label className="flex items-center gap-ds-2 text-body-sm">
              <input type="checkbox" name="regenerate" defaultChecked className="size-4 accent-[var(--blue-600)]" />
              Also update my Master Resume and Cover Letter
            </label>
          )}
          <div className="flex flex-col items-end gap-ds-2">
            <SaveButton label={firstTime ? "Save & create my documents" : "Save profile"} />
            {state?.error && (
              <p role="alert" className="text-body-sm text-danger">
                {state.error}
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving and creating your documents…" : label}
    </Button>
  );
}

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-[84px]">
      <CardHeader title={title} subtitle={subtitle} />
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


function F({ label, value, onChange, required, type = "text", placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; placeholder?: string; hint?: string }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} required={required} hint={hint}>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
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
