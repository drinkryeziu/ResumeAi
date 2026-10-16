import type { ReactNode } from "react";

export function StatCard({ label, value, icon, hint }: { label: string; value: ReactNode; icon: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-start gap-ds-3 rounded-md bg-white p-ds-4 shadow-card">
      <span className="text-blue-600" aria-hidden="true">
        {icon}
      </span>
      <div className="flex flex-col gap-ds-1">
        <span className="text-body-sm">{label}</span>
        <span className="text-heading-section">{value}</span>
        {hint && <span className="text-caption">{hint}</span>}
      </div>
    </div>
  );
}
