import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DIMENSION_LABELS, type FitLevel, type FitReport, type Strength } from "@/server/ai";

const FIT_TONE: Record<FitLevel, "success" | "info" | "warning" | "danger" | "neutral"> = {
  "Excellent fit": "success",
  "Strong fit": "success",
  "Good fit": "info",
  "Partial fit": "warning",
  "Weak fit": "danger",
  "Insufficient evidence": "neutral",
};
const STRENGTH_TONE: Record<Strength, "success" | "info" | "warning" | "danger"> = { Strong: "success", Good: "info", Partial: "warning", Weak: "danger" };

/** The overall conclusion in words, and how strong each area is. Mandatory requirements are judged apart from preferred ones. */
export function FitSummary({ fit }: { fit: FitReport }) {
  const rows = DIMENSION_LABELS.flatMap(([key, label]) => (fit[key] ? [{ label, value: fit[key] as Strength }] : []));
  return (
    <Card aria-labelledby="fit-h">
      <CardHeader title={<span id="fit-h">Overall fit</span>} subtitle="Judged requirement by requirement, from the evidence in your profile." />
      <div className="flex flex-col gap-ds-4">
        <div className="flex flex-col gap-ds-2">
          <p>
            <Badge tone={FIT_TONE[fit.overall]} className="text-body-sm">
              {fit.overall}
            </Badge>
          </p>
          <p className="text-body-sm">{fit.reason}</p>
        </div>
        {fit.mandatoryGaps.length > 0 && (
          <div>
            <h3 className="text-label-bold mb-ds-1">Mandatory requirements without enough evidence</h3>
            <ul className="list-disc pl-5 text-body-sm">
              {fit.mandatoryGaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        )}
        <dl className="grid grid-cols-1 gap-x-ds-4 gap-y-ds-2 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-ds-3 text-body-sm">
              <dt>{r.label}</dt>
              <dd>
                <Badge tone={STRENGTH_TONE[r.value]}>{r.value}</Badge>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}
