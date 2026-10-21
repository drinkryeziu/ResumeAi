"use client";

import "./globals.css";
import { ErrorScreen } from "@/components/features/errors/ErrorScreen";

/** The last safety net, for a failure in the root layout itself. It brings its own <html> and <body>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto w-full max-w-[1120px] px-ds-4 py-ds-5">
          <ErrorScreen error={error} reset={reset} />
        </main>
      </body>
    </html>
  );
}
