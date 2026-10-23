import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";

/**
 * A card that is shut until its heading is pressed: the heading, a short line and an optional badge always show, the content opens
 * and closes with the chevron. Plain <details>, so it works without scripts and from the keyboard.
 */
export function CollapsibleCard({
  id,
  title,
  subtitle,
  badge,
  defaultOpen = false,
  children,
}: {
  /** Used for the heading's id, so the card is labelled by it. */
  id: string;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Card aria-labelledby={id}>
      <details className="group" open={defaultOpen}>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-ds-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-col gap-ds-1">
            <span className="flex flex-wrap items-center gap-ds-3">
              <h2 id={id} className="text-card-title">
                {title}
              </h2>
              {badge}
            </span>
            {subtitle && <span className="text-body-sm">{subtitle}</span>}
          </span>
          <ChevronDown
            size={20}
            aria-hidden="true"
            className="mt-1 shrink-0 text-blue-600 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          />
          <span className="sr-only">Show or hide {title.toLowerCase()}</span>
        </summary>
        <div className="mt-ds-4">{children}</div>
      </details>
    </Card>
  );
}
