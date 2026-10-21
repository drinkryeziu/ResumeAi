"use client";

import { ErrorScreen } from "@/components/features/errors/ErrorScreen";

/** Any page that fails in the browser shows this instead of a blank "Application error" screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} />;
}
