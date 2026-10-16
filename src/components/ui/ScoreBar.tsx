export function ScoreBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="grid grid-cols-[140px_1fr_44px] items-center gap-ds-3">
      <span className="text-body-sm">{label}</span>
      <div className="h-2 overflow-hidden rounded-pill bg-sky-50" role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-pill bg-blue-600" style={{ width: `${v}%` }} />
      </div>
      <span className="text-label-bold text-right">{v}%</span>
    </div>
  );
}
