import { fmtYears, type CareerAnalysis } from "@/server/ai";

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-label-bold mb-ds-1">{title}</h3>
      <ul className="list-disc pl-5 text-body-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function Years({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="text-label-bold mb-ds-1">{title}</h3>
      <dl className="flex flex-col divide-y divide-gray-100">
        {rows.map(([name, years]) => (
          <div key={name} className="flex justify-between gap-ds-3 py-1 text-body-sm">
            <dt>{name}</dt>
            <dd className="font-bold">{fmtYears(years)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The line under the section's title: who this career adds up to. */
export const careerSubtitle = (a: CareerAnalysis) => `${a.primaryProfession}${a.seniority ? ` · ${a.seniority}` : ""} · ${fmtYears(a.totalYears)} in total`;

/** What the whole career adds up to, read from the profile alone (no job). Years come from the dates; overlapping jobs count once. */
export function CareerAnalysisBody({ analysis: a }: { analysis: CareerAnalysis }) {
  return (
    <div className="flex flex-col gap-ds-4">
      <Years title="By profession" rows={a.byProfession.map((p) => [p.name, p.years])} />
      <Years title="By industry" rows={a.byIndustry.map((p) => [p.name, p.years])} />
      {a.byProfessionInIndustry.length > 1 && <Years title="Profession within industry" rows={a.byProfessionInIndustry.map((p) => [`${p.profession} in ${p.industry}`, p.years])} />}
      {a.leadershipYears > 0 && <Years title="Leadership" rows={[["Leading people or projects", a.leadershipYears]]} />}
      {a.titleGroups.length > 0 && <List title="Different titles, the same work" items={a.titleGroups.map((g) => `${g.name} (${fmtYears(g.years)}): ${g.reason}`)} />}
      <List title="How your career has progressed" items={a.progression} />
      <List title="Your strengths" items={a.strengths} />
      <List title="What sets you apart" items={a.differentiators} />
      <List title="Could make your resume stronger" items={a.gaps} />
    </div>
  );
}
