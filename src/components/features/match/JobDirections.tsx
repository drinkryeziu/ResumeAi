import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { fmtYears, type Direction, type DirectionLevel } from "@/server/ai";

const LEVEL: Record<DirectionLevel, { label: string; tone: "success" | "info" | "neutral" }> = {
  best: { label: "Where you are strongest", tone: "success" },
  good: { label: "Also a good fit", tone: "info" },
  small: { label: "A long shot", tone: "neutral" },
};

/** The subtitle of the "Jobs to look for" section on the profile page. */
export const DIRECTIONS_SUBTITLE =
  "Where your work history is strongest, so you can search where your experience really fits. It is a guide, not a promise of getting hired.";

/**
 * The body of "Jobs to look for" on the profile page: which kinds of work the person's history points to, so they search where
 * they have a real chance, and a long button to start tailoring a resume to a job they found. Free (read from the career analysis)
 * and never worded as a chance of being hired.
 */
export function JobDirectionsBody({ rows }: { rows: Direction[] }) {
  const small = rows.some((r) => r.level === "small");
  return (
    <div className="flex flex-col gap-ds-4">
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
      <p className="text-caption">
        The percentages are each field&apos;s share of the time you have worked, added up from the dates in your profile.
        {small ? " A field marked as a long shot is a small part of your history: apply there only if the job is one you are ready to stretch for." : ""}
      </p>
      <ButtonLink href="/dashboard#tailor" className="w-full">
        Tailor your resume to a job
      </ButtonLink>
    </div>
  );
}
