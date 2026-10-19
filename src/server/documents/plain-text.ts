import { formatMonthYear } from "@/lib/format";
import { displayUrl, type CoverLetterDocument, type ResumeDocument } from "./model";

/**
 * Readable plain text for pasting into an application form ("Copy as text").
 * Everything comes from the stored document; nothing is added or reworded here.
 */
export function resumePlainText(doc: ResumeDocument): string {
  const heading = (t: string) => `\n${t.toUpperCase()}`;
  const lines: string[] = [doc.header.name, doc.header.headline];
  const contact = [doc.header.email, doc.header.phone, doc.header.location, ...doc.header.links.map((l) => displayUrl(l.url))].filter(Boolean).join(" | ");
  if (contact) lines.push(contact);
  if (doc.summary) lines.push(heading("Summary"), doc.summary);
  lines.push(heading("Experience"));
  doc.experience.forEach((e, i) => {
    if (i > 0) lines.push("");
    lines.push(`${e.title}, ${e.company}${e.location ? `, ${e.location}` : ""} (${formatMonthYear(e.startDate)} - ${formatMonthYear(e.endDate)})`);
    e.bullets.forEach((b) => lines.push(`- ${b}`));
  });
  if (doc.skills.length) lines.push(heading("Skills"), doc.skills.join(", "));
  if (doc.projects.length) lines.push(heading("Projects"), ...doc.projects.map((p) => `${p.name}. ${p.description}`));
  if (doc.education.length) {
    lines.push(heading("Education"));
    doc.education.forEach((e) => lines.push([[e.degree, e.field].filter(Boolean).join(", "), e.school].filter(Boolean).join(", ")));
  }
  if (doc.certifications.length) lines.push(heading("Certifications"), ...doc.certifications.map((c) => `${c.name}${c.issuer ? `, ${c.issuer}` : ""}`));
  (doc.additional ?? []).forEach((a) => lines.push(heading(a.heading), a.items.join(" | ")));
  return lines.join("\n");
}

export function coverLetterPlainText(doc: CoverLetterDocument): string {
  const date = new Date(`${doc.date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return [doc.sender.name, [doc.sender.email, doc.sender.phone, doc.sender.location].filter(Boolean).join(" | "), "", date, "", doc.greeting, "", doc.paragraphs.join("\n\n"), "", doc.closing, doc.signature]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}
