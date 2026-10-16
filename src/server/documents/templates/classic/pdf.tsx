import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatMonthYear } from "@/lib/format";
import { displayUrl, type CoverLetterDocument, type ResumeDocument } from "../../model";
import { classicTheme as t } from "./theme";

const s = StyleSheet.create({
  page: { padding: t.margin, fontFamily: t.font, fontSize: t.size.body, color: t.ink, lineHeight: 1.35 },
  name: { fontFamily: t.fontBold, fontSize: t.size.name, lineHeight: 1.2 },
  headline: { fontSize: t.size.headline, color: t.accent, marginTop: 4 },
  contact: { fontSize: t.size.small, color: t.muted, marginTop: 6 },
  section: { marginTop: 14 },
  sectionTitle: { fontFamily: t.fontBold, fontSize: t.size.section, color: t.accent, textTransform: "uppercase", letterSpacing: 0.6, borderBottomWidth: 0.75, borderBottomColor: t.rule, paddingBottom: 3, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  bold: { fontFamily: t.fontBold },
  muted: { color: t.muted, fontSize: t.size.small },
  bullet: { flexDirection: "row", marginTop: 2, paddingRight: 8 },
  dot: { width: 10 },
  item: { marginBottom: 8 },
  para: { marginBottom: 10 },
});

const range = (start?: string | null, end?: string | null) => `${formatMonthYear(start ?? undefined)} – ${formatMonthYear(end ?? undefined)}`;

export function ResumePdf({ doc }: { doc: ResumeDocument }) {
  const contact = [doc.header.email, doc.header.phone, doc.header.location].filter(Boolean).join("  ·  ");
  return (
    <Document title={`${doc.header.name} — Resume`} author={doc.header.name}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.name}>{doc.header.name}</Text>
        <Text style={s.headline}>{doc.header.headline}</Text>
        <Text style={s.contact}>
          {contact}
          {doc.header.links.map((l) => (
            <Text key={l.url}>
              {"  ·  "}
              <Link src={l.url}>{displayUrl(l.url)}</Link>
            </Text>
          ))}
        </Text>

        {doc.summary && (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Summary</Text>
            <Text>{doc.summary}</Text>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Experience</Text>
          {doc.experience.map((e) => (
            <View key={e.sourceId} style={s.item} wrap={false}>
              <View style={s.row}>
                <Text style={s.bold}>
                  {e.title}, {e.company}
                </Text>
                <Text style={s.muted}>{range(e.startDate, e.endDate)}</Text>
              </View>
              {e.location && <Text style={s.muted}>{e.location}</Text>}
              {e.bullets.map((b, i) => (
                <View key={i} style={s.bullet}>
                  <Text style={s.dot}>•</Text>
                  <Text>{b}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {doc.skills.length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Skills</Text>
            <Text>{doc.skills.join(", ")}</Text>
          </View>
        )}

        {doc.projects.length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Projects</Text>
            {doc.projects.map((p) => (
              <View key={p.sourceId} style={s.item}>
                <Text style={s.bold}>{p.name}</Text>
                <Text>{p.description}</Text>
              </View>
            ))}
          </View>
        )}

        {doc.education.length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Education</Text>
            {doc.education.map((e) => (
              <View key={e.sourceId} style={s.row}>
                <Text>
                  <Text style={s.bold}>{[e.degree, e.field].filter(Boolean).join(", ")}</Text>
                  {e.degree || e.field ? ", " : ""}
                  {e.school}
                </Text>
                {e.endDate && <Text style={s.muted}>{formatMonthYear(e.endDate)}</Text>}
              </View>
            ))}
          </View>
        )}

        {doc.certifications.length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Certifications</Text>
            {doc.certifications.map((c) => (
              <Text key={c.sourceId}>
                <Text style={s.bold}>{c.name}</Text>
                {c.issuer ? `, ${c.issuer}` : ""}
                {c.issueDate ? ` (${formatMonthYear(c.issueDate)})` : ""}
              </Text>
            ))}
          </View>
        )}
        {(doc.additional ?? []).map((a) => (
          <View key={a.heading} style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>{a.heading}</Text>
            <Text>{a.items.join("  ·  ")}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export function CoverLetterPdf({ doc }: { doc: CoverLetterDocument }) {
  const contact = [doc.sender.email, doc.sender.phone, doc.sender.location].filter(Boolean).join("  ·  ");
  return (
    <Document title={`${doc.sender.name} — Cover letter`} author={doc.sender.name}>
      <Page size="LETTER" style={{ ...s.page, lineHeight: 1.5 }}>
        <Text style={s.name}>{doc.sender.name}</Text>
        <Text style={s.contact}>{contact}</Text>
        <Text style={{ marginTop: 24, marginBottom: 16 }}>
          {new Date(`${doc.date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </Text>
        <Text style={s.para}>{doc.greeting}</Text>
        {doc.paragraphs.map((p, i) => (
          <Text key={i} style={s.para}>
            {p}
          </Text>
        ))}
        <Text style={{ marginTop: 6 }}>{doc.closing}</Text>
        <Text style={{ marginTop: 18 }}>{doc.signature}</Text>
      </Page>
    </Document>
  );
}
