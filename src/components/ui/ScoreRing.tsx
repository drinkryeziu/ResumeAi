/**
 * Circular score (0–100). Color is blue-600 — the action/brand color — rather than red/green,
 * because a "low" match is a to-do list, not a failure. The number always carries the meaning.
 */
export function ScoreRing({ value, label, size = 132 }: { value: number; label: string; size?: number }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <figure className="flex flex-col items-center gap-ds-2" aria-label={`${label}: ${clamped}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sky-50)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--blue-600)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fill="var(--navy-900)" style={{ font: "700 32px var(--font-sans)" }}>
          {clamped}%
        </text>
      </svg>
      <figcaption className="text-label-bold">{label}</figcaption>
    </figure>
  );
}
