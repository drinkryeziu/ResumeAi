import { formatMonthYear } from "@/lib/format";
import { headerLines, HEADER_SEPARATOR, senderLines, skillSections, type CoverLetterDocument, type ResumeDocument } from "./model";

/**
 * Readable plain text for pasting into an application form ("Copy as text").
 * Everything comes from the stored document; nothing is added or reworded here.
 */
export function resumePlainText(doc: ResumeDocument): string {
  const heading = (t: string) => `\n${t.toUpperCase()}`;
  const head = headerLines(doc.header);
  const lines: string[] = [head.name, head.headline];
  for (const line of [head.contact, head.place, head.links.map((l) => l.text).join(HEADER_SEPARATOR)]) if (line) lines.push(line);
  if (doc.summary) lines.push(heading("Summary"), doc.summary);
  lines.push(heading("Experience"));
  doc.experience.forEach((e, i) => {
    if (i > 0) lines.push("");
    lines.push(`${e.title}, ${e.company}${e.location ? `, ${e.location}` : ""} (${formatMonthYear(e.startDate)} - ${formatMonthYear(e.endDate)})`);
    e.bullets.forEach((b) => lines.push(`- ${b}`));
  });
  for (const s of skillSections(doc)) lines.push(heading(s.title), s.items.join(", "));
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
  const from = senderLines(doc.sender);
  const top = [from.name, from.headline, from.contact, from.place, from.links.join(HEADER_SEPARATOR)].filter(Boolean);
  return [...top, "", date, "", doc.greeting, "", doc.paragraphs.join("\n\n"), "", doc.closing, doc.signature].join("\n").replace(/\n{3,}/g, "\n\n");
}
