"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * A page that was loaded before a new version went live asks for files that no longer exist ("Loading chunk … failed",
 * "Failed to find Server Action"). Reloading fixes it, so it is done once automatically.
 */
export const isStaleDeployError = (e: Error) =>
  e.name === "ChunkLoadError" || /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|Failed to find Server Action|error loading dynamically imported module/i.test(e.message);

const RELOADED = "resumeai:reloaded-after-update";

/** Tells the site about a crash so it appears in the admin dashboard's error log. Just the error and the page address, nothing from the page. */
function report(error: Error & { digest?: string }) {
  try {
    void fetch("/api/errors", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: error.name, message: error.message, digest: error.digest, path: window.location.pathname }),
    }).catch(() => {});
  } catch {
    /* reporting must never cause another error */
  }
}

export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset?: () => void }) {
  const stale = isStaleDeployError(error);
  useEffect(() => {
    console.error("[app error]", error);
    if (!stale) report(error); // a page left open across an update is not a fault: reloading fixes it
    if (!stale) return;
    try {
      if (sessionStorage.getItem(RELOADED)) return; // once only, never a reload loop
      sessionStorage.setItem(RELOADED, "1");
    } catch {
      return;
    }
    window.location.reload();
  }, [error, stale]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-ds-4 py-ds-6 text-navy-900">
      <h1 className="text-heading-section">{stale ? "The site was just updated" : "Something went wrong on this page"}</h1>
      <p className="text-body">
        {stale ? "Reload the page to get the latest version. Nothing you saved was lost." : "Nothing you saved was lost. Try again, and if it keeps happening, reload the page or go back to the dashboard."}
      </p>
      <div className="flex flex-wrap items-center gap-ds-3">
        <Button type="button" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
        {reset && !stale && (
          <Button type="button" variant="secondary" onClick={reset}>
            Try again
          </Button>
        )}
        <a href="/dashboard" className="text-body-sm text-blue-700 underline">
          Go to the dashboard
        </a>
      </div>
      <details className="text-caption">
        <summary className="cursor-pointer">Details for support</summary>
        <p className="mt-ds-1 break-words">
          {error.name}: {error.message}
          {error.digest ? ` (code ${error.digest})` : ""}
        </p>
      </details>
    </div>
  );
}
