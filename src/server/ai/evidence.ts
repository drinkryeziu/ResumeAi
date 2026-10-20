import type { ProfileSnapshot } from "@/server/domain/profile";
import { experienceFactText } from "./experience";

/**
 * The evidence index: every fact the AI is allowed to use, flattened into id-tagged lines.
 * Prompts receive ONLY this list (plus the job). Outputs must cite these ids, and the
 * fabrication guard checks every cited id and every number against it.
 *
 * Id scheme (stable, human-readable in logs):
 *   summary · <expId> · <expId>#r<n> (responsibility) · <expId>#a<n> (achievement) · <expId>#t (tools)
 *   <eduId> · <skillId> · <certId> · <projectId> · <extraId> · <factId>
 */
export type EvidenceKind =
  | "summary"
  | "experience"
  | "responsibility"
  | "achievement"
  | "tools"
  | "education"
  | "skill"
  | "certification"
  | "project"
  | "extra"
  | "experience_total"
  | "approved_fact";

export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  text: string;
  /** For bullet-level items: the experience/project they belong to. */
  parentId?: string;
}

export function buildEvidence(profile: ProfileSnapshot): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  if (profile.summary?.trim()) items.push({ id: "summary", kind: "summary", text: profile.summary.trim() });

  for (const e of profile.experiences) {
    const when = `${e.startDate} – ${e.isCurrent ? "present" : e.endDate ?? "?"}`;
    items.push({ id: e.id, kind: "experience", text: `${e.title} at ${e.company}${e.location ? `, ${e.location}` : ""} (${when})` });
    e.responsibilities.forEach((r, i) => items.push({ id: `${e.id}#r${i}`, kind: "responsibility", text: r, parentId: e.id }));
    e.achievements.forEach((a, i) => items.push({ id: `${e.id}#a${i}`, kind: "achievement", text: a, parentId: e.id }));
    if (e.tools.length) items.push({ id: `${e.id}#t`, kind: "tools", text: `Tools used: ${e.tools.join(", ")}`, parentId: e.id });
  }
  const total = experienceFactText(profile);
  if (total) items.push({ id: "experience_total", kind: "experience_total", text: total });
  for (const ed of profile.education) {
    items.push({ id: ed.id, kind: "education", text: [ed.degree, ed.field, ed.school].filter(Boolean).join(", ") + (ed.description ? ` — ${ed.description}` : "") });
  }
  for (const s of profile.skills) items.push({ id: s.id, kind: "skill", text: `${s.name} (${s.category.toLowerCase()})` });
  for (const c of profile.certifications) items.push({ id: c.id, kind: "certification", text: [c.name, c.issuer].filter(Boolean).join(" — ") });
  for (const p of profile.projects) {
    items.push({
      id: p.id,
      kind: "project",
      text: [p.name, p.role && `role: ${p.role}`, p.description, p.results && `results: ${p.results}`, p.tools.length ? `tools: ${p.tools.join(", ")}` : ""]
        .filter(Boolean)
        .join(". "),
    });
  }
  for (const x of profile.extras) items.push({ id: x.id, kind: "extra", text: `${x.kind.toLowerCase()}: ${x.title}${x.detail ? ` — ${x.detail}` : ""}` });
  for (const f of profile.approvedFacts) {
    if (f.status === "APPROVED" && f.answer) items.push({ id: f.id, kind: "approved_fact", text: `${f.topic}: ${f.answer}` });
  }
  return items;
}

/** Serialized for prompts: one fact per line, wrapped so the model treats it as data. */
export function evidenceBlock(items: EvidenceItem[]): string {
  return ["<candidate_evidence>", ...items.map((i) => `[${i.id}] (${i.kind}) ${i.text}`), "</candidate_evidence>"].join("\n");
}

/** Every term the candidate can truthfully claim as a skill or tool. */
export function claimableTerms(profile: ProfileSnapshot): Set<string> {
  const terms = new Set<string>();
  const add = (t: string) => t.trim() && terms.add(t.trim().toLowerCase());
  profile.skills.forEach((s) => add(s.name));
  profile.experiences.forEach((e) => e.tools.forEach(add));
  profile.projects.forEach((p) => p.tools.forEach(add));
  profile.certifications.forEach((c) => add(c.name));
  profile.approvedFacts.filter((f) => f.status === "APPROVED").forEach((f) => add(f.topic));
  return terms;
}
