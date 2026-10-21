import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { CATEGORY_LABELS, MATCH_CATEGORIES, type MatchReport } from "@/server/ai";

/** The job's match numbers beside a document: the Job Match Score, the overall fit in words, and how each area scores. */
export function MatchMetricsCard({ jobId, overallScore, match }: { jobId: string; overallScore: number; match: MatchReport }) {
  return (
    <Card aria-labelledby="match-metrics-h">
      <CardHeader title={<span id="match-metrics-h">Job match</span>} subtitle="How well your profile fits this job." />
      <div className="flex flex-col gap-ds-4">
        <ScoreRing value={overallScore} label="Job Match Score" size={112} banded />
        {match.fit && (
          <p className="text-center">
            <Badge tone="info">{match.fit.overall}</Badge>
          </p>
        )}
        <div className="flex flex-col gap-ds-2">
          {MATCH_CATEGORIES.map((c) => {
            const v = match.scores.categories[c];
            return v === null ? null : <ScoreBar key={c} label={CATEGORY_LABELS[c]} value={v} />;
          })}
        </div>
        <Link href={`/jobs/${jobId}/match`} className="text-body-sm text-blue-700 underline">
          See the full match report
        </Link>
      </div>
    </Card>
  );
}
