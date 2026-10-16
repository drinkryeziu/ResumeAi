import type { ReactNode } from "react";

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-ds-5 flex flex-wrap items-end justify-between gap-ds-4">
      <div className="flex flex-col gap-ds-2">
        {eyebrow && <div className="text-label-bold text-blue-600">{eyebrow}</div>}
        <h1 className="text-heading-section">{title}</h1>
        {description && <p className="text-body max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-ds-4">{actions}</div>}
    </div>
  );
}
