import { Card, CardHeader } from "@/components/ui/Card";
import { fmtYears, type ExperienceSummary } from "@/server/ai";

/** Experience counted four ways, from the dates: overlapping roles once, profession and industry kept apart. */
export function ExperienceSummaryCard({ summary, profession, industry }: { summary: ExperienceSummary; profession: string | null; industry: string | null }) {
  const rows: Array<[string, string, string?]> = [
    ["All professional experience", fmtYears(summary.totalYears)],
    [profession ? `Same profession (${profession})` : "Same profession as the job", fmtYears(summary.professionYears), summary.professionRelatedYears > summary.professionYears ? `${fmtYears(summary.professionRelatedYears)} with related professions` : undefined],
    ...(industry
      ? ([
          [`Same industry (${industry})`, fmtYears(summary.industryDirectYears), summary.industryRelatedYears > summary.industryDirectYears ? `${fmtYears(summary.industryRelatedYears)} with closely related industries` : undefined],
          ["Same profession and industry together", fmtYears(summary.professionInIndustryYears), "Only the jobs that are both, not the two totals added"],
        ] as Array<[string, string, string?]>)
      : []),
    ...(summary.leadershipYears > 0 ? ([["Leading people or projects", fmtYears(summary.leadershipYears)]] as Array<[string, string]>) : []),
  ];
  return (
    <Card aria-labelledby="experience-h">
      <CardHeader title={<span id="experience-h">Your experience for this job</span>} subtitle="Added up from your dates. Overlapping jobs are counted once, and a profession is never added to an industry." />
      <dl className="flex flex-col divide-y divide-gray-100">
        {rows.map(([label, value, note]) => (
          <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-ds-4 py-ds-2 text-body-sm">
            <dt>
              {label}
              {note && <span className="block text-caption">{note}</span>}
            </dt>
            <dd className="font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      {summary.titleGroups.length > 0 && (
        <div className="mt-ds-4">
          <h3 className="text-label-bold mb-ds-1">Different titles, the same work</h3>
          <ul className="flex flex-col gap-ds-1 text-body-sm">
            {summary.titleGroups.map((g) => (
              <li key={g.name}>
                <strong>{g.name}</strong> · {fmtYears(g.years)}. {g.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="mt-ds-4 text-body-sm">
        <summary className="cursor-pointer text-blue-700 underline">How each job was counted</summary>
        <ul className="mt-ds-2 flex flex-col gap-ds-2">
          {summary.roles.map((r) => (
            <li key={r.experienceId}>
              <strong>
                {r.title} · {r.company}
              </strong>{" "}
              ({fmtYears(r.years)}): {r.professionFit === "same" ? "same profession" : r.professionFit === "related" ? "related profession" : "different profession"}; {r.industry}, {r.industryFit === "direct" ? "same industry" : r.industryFit === "related" ? "closely related industry" : r.industryFit === "transferable" ? "a different industry" : "an unrelated industry"}.
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
