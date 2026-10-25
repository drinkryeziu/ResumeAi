"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";
import { formatDate, formatNumber } from "@/lib/format";
import { filterPeople, FIRST_DIR, SORT_LABELS, sortPeople, type PersonRow, type SortDir, type SortKey } from "@/server/admin/people-table";
import { RemoveUserDialog } from "./RemoveUserDialog";

const score = (n: number | null) => (n === null ? "—" : `${n}%`);
const COLUMNS: Array<{ key: SortKey; align: "left" | "right" }> = [
  { key: "name", align: "left" },
  { key: "applications", align: "right" },
  { key: "applied", align: "right" },
  { key: "averageScore", align: "right" },
  { key: "lastActiveAt", align: "left" },
  { key: "status", align: "left" },
];

/**
 * The people table: a search box on top (by name, or email), sortable column headers on a wide screen and a "Sort by" menu on a
 * phone. Newest activity first to begin with. The owner also gets a Delete link on every row but their own.
 */
export function PeopleTable({ rows, canRemove, ownerEmail }: { rows: PersonRow[]; canRemove: boolean; ownerEmail: string }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "lastActiveAt", dir: "desc" });
  const shown = useMemo(() => sortPeople(filterPeople(rows, query), sort.key, sort.dir), [rows, query, sort]);

  const choose = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: FIRST_DIR[key] }));
  const remove = (r: PersonRow) => (canRemove && r.email !== ownerEmail ? <RemoveUserDialog userId={r.id} name={r.name} email={r.email} /> : null);
  const status = (r: PersonRow) => <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Inactive"}</Badge>;

  return (
    <div className="flex flex-col gap-ds-4">
      <div className="flex flex-col gap-ds-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <div className="flex flex-col gap-ds-1">
            <label htmlFor="people-search" className="text-label-bold">
              Search by name
            </label>
            <div className="relative">
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-ds-2 -translate-y-1/2 text-gray-500" />
              <Input id="people-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" aria-describedby="people-search-hint" className="pl-9" />
            </div>
            <p id="people-search-hint" className="text-caption">
              Also matches email addresses.
            </p>
          </div>
        </div>
        {/* Phones have no column headers to press, so the same choice is a menu. */}
        <div className="flex items-end gap-ds-2 md:hidden">
          <div className="flex flex-col gap-ds-1">
            <label htmlFor="people-sort" className="text-label-bold">
              Sort by
            </label>
            <Select id="people-sort" value={sort.key} onChange={(e) => setSort({ key: e.target.value as SortKey, dir: FIRST_DIR[e.target.value as SortKey] })}>
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {SORT_LABELS[c.key]}
                </option>
              ))}
            </Select>
          </div>
          <button
            type="button"
            onClick={() => setSort((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }))}
            className="inline-flex h-11 items-center gap-1 rounded-sm bg-gray-100 px-ds-3 text-body-sm"
            aria-label={`Order: ${sort.dir === "asc" ? "ascending" : "descending"}. Press to reverse.`}
          >
            {sort.dir === "asc" ? <ArrowUp size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />}
            {sort.dir === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>
      </div>

      <p role="status" className="text-caption">
        {query.trim() ? `${formatNumber(shown.length)} of ${formatNumber(rows.length)} ${rows.length === 1 ? "person" : "people"}` : `${formatNumber(rows.length)} ${rows.length === 1 ? "person" : "people"}`}
      </p>

      {shown.length === 0 ? (
        <p className="text-body-sm">No one matches “{query.trim()}”.</p>
      ) : (
        <>
          {/* Phones: one card per person. */}
          <ul className="flex flex-col gap-ds-2 md:hidden">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-col gap-ds-2 rounded-md bg-gray-100 p-ds-3">
                <div className="flex items-start justify-between gap-ds-3">
                  <span className="min-w-0">
                    <span className="text-label-bold">{r.name}</span>
                    <span className="text-caption block truncate">{r.email}</span>
                  </span>
                  {status(r)}
                </div>
                <dl className="grid grid-cols-3 gap-ds-2 text-body-sm">
                  <div>
                    <dt className="text-caption">Created</dt>
                    <dd className="text-label-bold">{formatNumber(r.applications)}</dd>
                  </div>
                  <div>
                    <dt className="text-caption">Applied</dt>
                    <dd className="text-label-bold">{formatNumber(r.applied)}</dd>
                  </div>
                  <div>
                    <dt className="text-caption">Avg score</dt>
                    <dd className="text-label-bold">{score(r.averageScore)}</dd>
                  </div>
                </dl>
                <div className="flex items-center justify-between gap-ds-3">
                  <p className="text-caption">Last active {formatDate(r.lastActiveAt)}</p>
                  {remove(r)}
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <table className="w-full text-left text-body-sm">
              <caption className="sr-only">People using KRZ Resume AI. Press a column heading to sort by it.</caption>
              <thead>
                <tr className="text-caption">
                  {COLUMNS.map((c) => {
                    const active = sort.key === c.key;
                    return (
                      <th key={c.key} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`py-ds-2 pr-ds-3 font-semibold ${c.align === "right" ? "text-right" : ""}`}>
                        <button
                          type="button"
                          onClick={() => choose(c.key)}
                          className={`inline-flex items-center gap-1 rounded-sm hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 ${active ? "text-blue-700" : ""}`}
                        >
                          {SORT_LABELS[c.key]}
                          {active ? sort.dir === "asc" ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" /> : <ArrowUpDown size={14} aria-hidden="true" className="text-gray-500" />}
                        </button>
                      </th>
                    );
                  })}
                  {canRemove && (
                    <th scope="col" className="py-ds-2 pl-ds-3 text-right font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <th scope="row" className="py-ds-3 pr-ds-3 font-normal">
                      <span className="text-label-bold">{r.name}</span>
                      <span className="text-caption block">{r.email}</span>
                    </th>
                    <td className="px-ds-3 py-ds-3 text-right tabular-nums">{formatNumber(r.applications)}</td>
                    <td className="px-ds-3 py-ds-3 text-right tabular-nums">{formatNumber(r.applied)}</td>
                    <td className="px-ds-3 py-ds-3 text-right tabular-nums">{score(r.averageScore)}</td>
                    <td className="px-ds-3 py-ds-3">{formatDate(r.lastActiveAt)}</td>
                    <td className="py-ds-3 pl-ds-3">{status(r)}</td>
                    {canRemove && <td className="py-ds-3 pl-ds-3 text-right">{remove(r)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
