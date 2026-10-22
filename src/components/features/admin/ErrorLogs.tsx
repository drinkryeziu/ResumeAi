import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { clearErrorGroup } from "@/app/(app)/admin/actions";
import { formatNumber } from "@/lib/format";
import { groupErrors, sourceLabel, type ErrorEntry } from "@/server/admin/errors";
import { LocalTime } from "./LocalTime";

const plural = (n: number, noun: string) => `${formatNumber(n)} ${noun}${n === 1 ? "" : "s"}`;

/**
 * What went wrong for people, newest first: the same problem is one row with a count, and below it the latest individual errors
 * with who ran into them. The owner can mark a problem as fixed, which clears it from the list.
 */
export function ErrorLogs({
  total,
  entries,
  who,
  canClear,
  days,
}: {
  total: number;
  entries: ErrorEntry[];
  who: Map<string, { name: string; email: string }>;
  canClear: boolean;
  days: number;
}) {
  const groups = groupErrors(entries);
  const people = new Set(entries.flatMap((e) => (e.userId ? [e.userId] : []))).size;
  const person = (id: string | null) => {
    if (!id) return "Signed out or unknown";
    const u = who.get(id);
    return u ? `${u.name} (${u.email})` : "A deleted account";
  };
  return (
    <Card aria-labelledby="errors-h">
      {/* Closed to begin with: the header says how many problems there are, and opening it shows them. */}
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-ds-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-col gap-ds-1">
            <span className="flex flex-wrap items-center gap-ds-3">
              <h2 id="errors-h" className="text-card-title">
                Error logs
              </h2>
              <Badge tone={groups.length === 0 ? "success" : "warning"}>{groups.length === 0 ? "No errors" : plural(groups.length, "problem")}</Badge>
            </span>
            <span className="text-body-sm">
              {`Problems people ran into in the last ${days} days, so you can fix them. Messages never include anyone's documents.${total === 0 ? "" : ` ${plural(total, "error")} from ${plural(people, "person")} that we can name.`}`}
            </span>
          </span>
          <ChevronDown
            size={20}
            aria-hidden="true"
            className="mt-1 shrink-0 text-blue-600 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          />
          <span className="sr-only">Show or hide the error logs</span>
        </summary>
        <div className="mt-ds-4">
          {groups.length === 0 ? (
            <p className="text-body-sm">No errors logged. Nobody has run into a problem lately.</p>
          ) : (
            <div className="flex flex-col gap-ds-5">
              <section aria-labelledby="errors-groups-h" className="flex flex-col gap-ds-2">
                <h3 id="errors-groups-h" className="text-label-bold">
                  By problem
                </h3>
                <ul className="flex flex-col gap-ds-2">
                  {groups.map((g) => (
                    <li
                      key={`${g.source}:${g.code}`}
                      className="flex flex-wrap items-start justify-between gap-x-ds-4 gap-y-ds-2 rounded-md bg-gray-100 px-ds-3 py-ds-3"
                    >
                      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-ds-2">
                          <span className="text-label-bold">{sourceLabel(g.source)}</span>
                          <Badge tone="neutral">{g.code}</Badge>
                        </span>
                        <span className="text-body-sm break-words">{g.message}</span>
                        <span className="text-caption">
                          {plural(g.count, "time")} · {plural(g.people, "person")} · last <LocalTime iso={g.lastAt.toISOString()} />
                        </span>
                      </div>
                      {canClear && (
                        <form action={clearErrorGroup}>
                          <input type="hidden" name="source" value={g.source} />
                          <input type="hidden" name="code" value={g.code} />
                          <button
                            type="submit"
                            aria-label={`Mark as fixed: ${sourceLabel(g.source)}, ${g.code}`}
                            className="text-body-sm text-blue-700 underline"
                          >
                            Mark as fixed
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="errors-recent-h" className="flex flex-col gap-ds-2">
                <h3 id="errors-recent-h" className="text-label-bold">
                  Latest errors
                </h3>
                <ul className="flex flex-col gap-ds-2">
                  {entries.slice(0, 10).map((e) => (
                    <li key={e.id} className="flex flex-col gap-1 rounded-md bg-gray-100 px-ds-3 py-ds-2 text-body-sm">
                      <span className="flex flex-wrap items-center justify-between gap-x-ds-4 gap-y-1">
                        <span className="text-label-bold">
                          {sourceLabel(e.source)} <span className="font-normal text-caption">· {e.code}</span>
                        </span>
                        <span className="text-caption">
                          <LocalTime iso={new Date(e.at).toISOString()} />
                        </span>
                      </span>
                      <span className="break-words">{e.message}</span>
                      <span className="text-caption">
                        {person(e.userId)}
                        {e.path ? ` · ${e.path}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}
