import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { fmtYears, LABEL_TEXT, labelOf, type JobAnalysis, type MatchLabel, type MatchReport } from "@/server/ai";

const LABEL_TONE: Record<MatchLabel, "success" | "info" | "warning" | "danger" | "neutral"> = {
  strong: "success",
  match: "success",
  partial: "info",
  weak: "warning",
  none: "danger",
  unknown: "neutral",
};

/** What the job asks for, in a few words: "5+ years · graphic design", or "Skill", "Tool"… */
function asked(r: JobAnalysis["requirements"][number]): string {
  if (r.years) return `${r.years}+ years${r.subject ? ` · ${r.subject}` : ""}`;
  const kind = r.category.replace("_", " ");
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** Qualifying experience for requirements measured in years; "—" for everything else (and for matches saved before this existed). */
function qualifying(a: MatchReport["assessments"][number]): string {
  if (a.qualifyingYears === undefined || a.qualifyingYears === null) return "—";
  const related = a.relatedYears && a.relatedYears > 0 ? ` and ${fmtYears(a.relatedYears)} in related roles` : "";
  return a.qualifyingYears > 0 ? `${fmtYears(a.qualifyingYears)} direct${related}` : `none direct${related}`;
}

/** Every important requirement with the evidence behind its label. Mandatory ones come first. */
export function RequirementScorecard({ analysis, match }: { analysis: JobAnalysis; match: MatchReport }) {
  const byId = new Map(match.assessments.map((a) => [a.requirementId, a]));
  const rows = analysis.requirements
    .flatMap((r) => {
      const a = byId.get(r.id);
      return a ? [{ r, a, label: labelOf(a) }] : [];
    })
    .sort((x, y) => Number(y.r.importance === "required") - Number(x.r.importance === "required"));
  return (
    <Card aria-labelledby="scorecard-h">
      <CardHeader title={<span id="scorecard-h">Requirement scorecard</span>} subtitle="Each requirement, what the job asks for and what your profile shows." />
      <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,0.9fr)] gap-ds-3 pb-ds-2 text-label-bold lg:grid" aria-hidden="true">
        <span>Requirement</span>
        <span>Asked</span>
        <span>Your evidence</span>
        <span>Match</span>
      </div>
      <ul className="flex flex-col divide-y divide-gray-100">
        {rows.map(({ r, a, label }) => (
          <li key={r.id} className="grid grid-cols-1 gap-ds-2 py-ds-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,0.9fr)] lg:gap-ds-3">
            <div className="flex flex-col gap-ds-1">
              <span className="text-body-sm font-semibold">{r.text}</span>
              <span>
                <Badge tone={r.importance === "required" ? "neutral" : "info"}>{r.importance === "required" ? "Mandatory" : "Preferred"}</Badge>
              </span>
            </div>
            <p className="text-body-sm">
              <span className="text-caption lg:sr-only">Asked: </span>
              {asked(r)}
            </p>
            <div className="text-body-sm">
              <span className="text-caption lg:sr-only">Your evidence: </span>
              {a.explanation}
              {a.qualifyingYears !== undefined && a.qualifyingYears !== null && (
                <span className="mt-ds-1 block text-caption">Qualifying experience: {qualifying(a)}</span>
              )}
            </div>
            <p>
              <Badge tone={LABEL_TONE[label]}>{LABEL_TEXT[label]}</Badge>
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
