import { AlignmentType, BorderStyle, Document, ExternalHyperlink, LevelFormat, Packer, Paragraph, TabStopType, TextRun } from "docx";
import { formatMonthYear } from "@/lib/format";
import { headerLines, HEADER_SEPARATOR, senderContact, skillSections, type CoverLetterDocument, type ResumeDocument } from "../../model";
import { classicTheme as t } from "./theme";

/**
 * Native Word output: real paragraphs, a real bullet list and a right tab stop for dates.
 * No tables, text boxes or columns — those are what trip up ATS parsers.
 */
const hex = (c: string) => c.replace("#", "");
const pt = (n: number) => n * 2; // docx sizes are half-points
const RIGHT_TAB = 9360; // 6.5" text width in twentieths of a point

const sectionTitle = (text: string) =>
  new Paragraph({
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: hex(t.rule), space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: pt(t.size.section), color: hex(t.accent), font: "Arial" })],
  });

const run = (text: string, opts: { bold?: boolean; color?: string; size?: number } = {}) =>
  new TextRun({ text, bold: opts.bold, color: hex(opts.color ?? t.ink), size: pt(opts.size ?? t.size.body), font: "Arial" });

const numbering = {
  config: [
    {
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }],
    },
  ],
};

export async function resumeDocx(doc: ResumeDocument): Promise<Buffer> {
  const head = headerLines(doc.header);
  // One line each, in order: name, job title, phone and email, city and state, links. The last line leaves the gap before the body.
  const muted = (text: string, after?: number) => new Paragraph({ spacing: after ? { after } : undefined, children: [run(text, { color: t.muted, size: t.size.small })] });
  const lastIsLinks = head.links.length > 0;
  const children: Paragraph[] = [
    new Paragraph({ children: [run(head.name, { bold: true, size: t.size.name })] }),
    new Paragraph({ children: [run(head.headline, { color: t.accent, size: t.size.headline })] }),
    ...(head.contact ? [muted(head.contact, head.place || lastIsLinks ? undefined : 120)] : []),
    ...(head.place ? [muted(head.place, lastIsLinks ? undefined : 120)] : []),
    ...(lastIsLinks
      ? [
          new Paragraph({
            spacing: { after: 120 },
            children: head.links.flatMap((l, i) => [
              ...(i > 0 ? [run(HEADER_SEPARATOR, { color: t.muted, size: t.size.small })] : []),
              new ExternalHyperlink({ link: l.url, children: [run(l.text, { color: t.accent, size: t.size.small })] }),
            ]),
          }),
        ]
      : []),
  ];

  if (doc.summary) children.push(sectionTitle("Summary"), new Paragraph({ children: [run(doc.summary)] }));

  children.push(sectionTitle("Experience"));
  for (const e of doc.experience) {
    children.push(
      new Paragraph({
        spacing: { before: 120 },
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        children: [run(`${e.title}, ${e.company}`, { bold: true }), run(`\t${formatMonthYear(e.startDate)} – ${formatMonthYear(e.endDate ?? undefined)}`, { color: t.muted, size: t.size.small })],
      }),
    );
    if (e.location) children.push(new Paragraph({ children: [run(e.location, { color: t.muted, size: t.size.small })] }));
    for (const b of e.bullets) children.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [run(b)] }));
  }

  for (const s of skillSections(doc)) children.push(sectionTitle(s.title), new Paragraph({ children: [run(s.items.join(", "))] }));

  if (doc.projects.length) {
    children.push(sectionTitle("Projects"));
    for (const p of doc.projects) children.push(new Paragraph({ spacing: { before: 80 }, children: [run(p.name, { bold: true })] }), new Paragraph({ children: [run(p.description)] }));
  }

  if (doc.education.length) {
    children.push(sectionTitle("Education"));
    for (const e of doc.education) {
      children.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
          children: [
            run([e.degree, e.field].filter(Boolean).join(", "), { bold: true }),
            run(`${e.degree || e.field ? ", " : ""}${e.school}`),
            run(e.endDate ? `\t${formatMonthYear(e.endDate)}` : "", { color: t.muted, size: t.size.small }),
          ],
        }),
      );
    }
  }

  if (doc.certifications.length) {
    children.push(sectionTitle("Certifications"));
    for (const c of doc.certifications) {
      children.push(new Paragraph({ children: [run(c.name, { bold: true }), run(`${c.issuer ? `, ${c.issuer}` : ""}${c.issueDate ? ` (${formatMonthYear(c.issueDate)})` : ""}`)] }));
    }
  }

  for (const a of doc.additional ?? []) children.push(sectionTitle(a.heading), new Paragraph({ children: [run(a.items.join("  ·  "))] }));

  const file = new Document({
    creator: doc.header.name,
    title: `${doc.header.name} — Resume`,
    numbering,
    sections: [{ properties: { page: { margin: { top: 880, bottom: 880, left: 1080, right: 1080 } } }, children }],
  });
  return Packer.toBuffer(file);
}

export async function coverLetterDocx(doc: CoverLetterDocument): Promise<Buffer> {
  const p = (text: string, after = 200) => new Paragraph({ spacing: { after, line: 300 }, children: [run(text)] });
  const date = new Date(`${doc.date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const file = new Document({
    creator: doc.sender.name,
    title: `${doc.sender.name} — Cover letter`,
    sections: [
      {
        properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
        children: [
          new Paragraph({ children: [run(doc.sender.name, { bold: true, size: t.size.name })] }),
          new Paragraph({ spacing: { after: 360 }, children: [run(senderContact(doc.sender).join("  ·  "), { color: t.muted, size: t.size.small })] }),
          p(date, 280),
          p(doc.greeting),
          ...doc.paragraphs.map((x) => p(x)),
          p(doc.closing, 400),
          p(doc.signature),
        ],
      },
    ],
  });
  return Packer.toBuffer(file);
}
