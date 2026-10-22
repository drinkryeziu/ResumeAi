import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
}
export interface Row {
  id: string;
  cells: Record<string, ReactNode>;
  /** The row to look at first. */
  emphasis?: boolean;
}

/**
 * A plain table for facts and numbers. Wide screens get columns; on a phone each row becomes a small card with its first cell as
 * the title and the other cells as "label … value" lines, so nothing scrolls sideways.
 */
export function DataTable({ caption, columns, rows }: { caption: string; columns: Column[]; rows: Row[] }) {
  return (
    <table className="w-full text-left text-body-sm max-md:block">
      <caption className="sr-only">{caption}</caption>
      <thead className="max-md:sr-only">
        <tr>
          {columns.map((c, i) => (
            <th key={c.key} scope="col" className={cn("py-ds-2 text-caption font-semibold", i < columns.length - 1 && "pr-ds-3", c.align === "right" && "text-right")}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="max-md:flex max-md:flex-col max-md:gap-ds-2">
        {rows.map((r) => (
          <tr key={r.id} className={cn("border-t border-gray-100 max-md:block max-md:rounded-md max-md:border-0 max-md:p-ds-3", r.emphasis ? "bg-sky-50 font-bold max-md:bg-sky-50" : "max-md:bg-gray-100")}>
            {columns.map((c, i) =>
              i === 0 ? (
                <th key={c.key} scope="row" className="py-ds-3 pr-ds-3 text-left font-[inherit] max-md:block max-md:py-0 max-md:pb-ds-2 max-md:text-label-bold">
                  {r.cells[c.key]}
                </th>
              ) : (
                <td
                  key={c.key}
                  data-label={c.label}
                  className={cn(
                    "py-ds-3 tabular-nums",
                    i < columns.length - 1 && "pr-ds-3",
                    c.align === "right" && "text-right",
                    "max-md:flex max-md:justify-between max-md:gap-ds-3 max-md:py-1 max-md:pr-0 max-md:text-right max-md:before:text-left max-md:before:text-caption max-md:before:font-normal max-md:before:content-[attr(data-label)]",
                  )}
                >
                  {r.cells[c.key]}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
