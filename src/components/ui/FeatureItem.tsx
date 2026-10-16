import type { ReactNode } from "react";

/** Design-system FeatureItem: line icon (blue-600), heading-feature title, one body-sm sentence. */
export function FeatureItem({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex max-w-[260px] flex-col gap-ds-1">
      <span className="mb-ds-2 text-blue-600" aria-hidden="true">
        {icon}
      </span>
      <h4 className="text-heading-feature">{title}</h4>
      <p className="text-body-sm">{children}</p>
    </div>
  );
}
