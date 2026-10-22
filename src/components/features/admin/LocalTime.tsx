"use client";

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** A moment in the reader's own time zone (the server can't know it, so the first paint may differ and is allowed to). */
export function LocalTime({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {fmt.format(new Date(iso))}
    </time>
  );
}
