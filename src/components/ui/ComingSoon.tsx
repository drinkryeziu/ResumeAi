import type { ReactNode } from "react";
import { Card } from "./Card";
import { PageHeader } from "./PageHeader";

/** Placeholder for pages scheduled in a later phase, so navigation never dead-ends. */
export function ComingSoon({ title, description, phase, children }: { title: string; description: string; phase: string; children?: ReactNode }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card className="flex flex-col gap-ds-3">
        <p className="text-label-bold text-blue-600">Arrives in {phase}</p>
        {children}
      </Card>
    </>
  );
}
