import { Compass } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { fmtYears, jobDirections, type DirectionLevel } from "@/server/ai";
import type { CareerAnalysis } from "@/server/ai";

const LEVEL: Record<DirectionLevel, { label: string; tone: "success" | "info" | "neutral" }> = {
  best: { label: "Where you are strongest", tone: "success" },
  good: { label: "Also a good fit", tone: "info" },
  small: { label: "A long shot", tone: "neutral" },
};

/**
 * "Jobs to look for", on the dashboard: which kinds of work the person's history points to, so they search where they have a
 * real chance. Free (read from the Master Resume's career analysis) and never worded as a chance of being hired.
 */
export function JobDirectionsCard({ analysis }: { analysis: Pick<CareerAnalysis, "byProfession" | "totalYears"> | null | undefined }) {
  const rows = jobDirections(analysis);
  if (rows.length === 0) return null;
  const small = rows.some((r) => r.level === "small");
  return (
    <Card aria-labelledby="directions-h">
      <CardHeader
        title={
          <span id="directions-h" className="flex items-center gap-ds-2">
            <Compass size={20} aria-hidden="true" className="text-blue-600" /> Jobs to look for
          </span>
        }
        subtitle="Where your work history is strongest, so you can search where your experience really fits. It is a guide, not a promise of getting hired."
      />
      <ul className="flex flex-col gap-ds-3">
        {rows.map((r) => (
          <li key={r.name} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center justify-between gap-x-ds-3 gap-y-1">
              <span className="text-label-bold">{r.name}</span>
              <span className="flex items-center gap-ds-2">
                <Badge tone={LEVEL[r.level].tone}>{LEVEL[r.level].label}</Badge>
                <span className="text-label-bold tabular-nums">{r.percent}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-pill bg-sky-50" role="img" aria-label={`${r.percent}% of your experience is in ${r.name}`}>
              <div className="h-full rounded-pill bg-blue-600" style={{ width: `${r.percent}%` }} />
            </div>
            <span className="text-caption">{`${fmtYears(r.years)} of work in this field`}</span>
          </li>
        ))}
      </ul>
      <p className="mt-ds-3 text-caption">
        The percentages are each field&apos;s share of the time you have worked, added up from the dates in your profile.
        {small ? " A field marked as a long shot is a small part of your history: apply there only if the job is one you are ready to stretch for." : ""}
      </p>
    </Card>
  );
}
