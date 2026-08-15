"use client";

import { useEffect } from "react";

/**
 * Root error boundary. The previous project had none, so any render failure
 * produced a blank white page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest correlates with the server-side log entry; the message itself
    // is not surfaced to the user.
    console.error("Render error", error.digest ?? error.name);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="text-slate-600">
        The page could not be displayed. You can try again, or return to the dashboard.
      </p>
      {error.digest ? (
        <p className="text-xs text-slate-400">Reference: {error.digest}</p>
      ) : null}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
        >
          Dashboard
        </a>
      </div>
    </main>
  );
}
