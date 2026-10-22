import { formatMonthYear } from "@/lib/format";
import { displayUrl, senderContact, skillSections, type CoverLetterDocument, type ResumeDocument } from "@/server/documents/model";

/** On-screen rendering of the same ResumeDocument the PDF/DOCX exporters use. */
export function ResumePreview({ doc }: { doc: ResumeDocument }) {
  const h = (t: string) => <h3 className="mt-ds-4 mb-ds-2 border-b border-[#c9d3e3] pb-1 text-[11px] font-bold tracking-[0.6px] text-blue-700 uppercase">{t}</h3>;
  return (
    <article aria-label="Resume preview" className="rounded-md bg-white p-ds-5 text-[13px] leading-[1.45] shadow-card">
      <h2 className="text-[22px] font-bold">{doc.header.name}</h2>
      <p className="text-blue-700">{doc.header.headline}</p>
      <p className="mt-1 text-[12px] text-navy-900/80">
        {[doc.header.email, doc.header.phone, doc.header.location, ...doc.header.links.map((l) => displayUrl(l.url))].filter(Boolean).join("  ·  ")}
      </p>
      {doc.summary && (
        <>
          {h("Summary")}
          <p>{doc.summary}</p>
        </>
      )}
      {h("Experience")}
      {doc.experience.map((e) => (
        <section key={e.sourceId} className="mb-ds-3">
          <div className="flex flex-wrap justify-between gap-2">
            <strong>
              {e.title}, {e.company}
            </strong>
            <span className="text-[12px]">
              {formatMonthYear(e.startDate)} – {formatMonthYear(e.endDate ?? undefined)}
            </span>
          </div>
          <ul className="mt-1 list-disc pl-5">
            {e.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </section>
      ))}
      {skillSections(doc).map((sec) => (
        <div key={sec.title}>
          {h(sec.title)}
          <p>{sec.items.join(", ")}</p>
        </div>
      ))}
      {doc.projects.length > 0 && (
        <>
          {h("Projects")}
          {doc.projects.map((p) => (
            <p key={p.sourceId} className="mb-1">
              <strong>{p.name}.</strong> {p.description}
            </p>
          ))}
        </>
      )}
      {doc.education.length > 0 && (
        <>
          {h("Education")}
          {doc.education.map((e) => (
            <p key={e.sourceId}>
              <strong>{[e.degree, e.field].filter(Boolean).join(", ")}</strong>
              {e.degree || e.field ? ", " : ""}
              {e.school}
            </p>
          ))}
        </>
      )}
      {doc.certifications.length > 0 && (
        <>
          {h("Certifications")}
          {doc.certifications.map((c) => (
            <p key={c.sourceId}>
              <strong>{c.name}</strong>
              {c.issuer ? `, ${c.issuer}` : ""}
            </p>
          ))}
        </>
      )}
      {(doc.additional ?? []).map((a) => (
        <div key={a.heading}>
          {h(a.heading)}
          <p>{a.items.join(" · ")}</p>
        </div>
      ))}
    </article>
  );
}

export function CoverLetterPreview({ doc }: { doc: CoverLetterDocument }) {
  return (
    <article aria-label="Cover letter preview" className="flex flex-col gap-ds-3 rounded-md bg-white p-ds-5 text-[14px] leading-[1.6] shadow-card">
      <div>
        <h2 className="text-[20px] font-bold">{doc.sender.name}</h2>
        <p className="text-[12px]">{senderContact(doc.sender).join("  ·  ")}</p>
      </div>
      <p>{new Date(`${doc.date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      <p>{doc.greeting}</p>
      {doc.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <p>
        {doc.closing}
        <br />
        <br />
        {doc.signature}
      </p>
    </article>
  );
}
