"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary.
 *
 * `app/error.tsx` only catches failures BELOW the root layout. If the root
 * layout itself (providers, theme, fonts) throws, Next.js renders this file
 * instead — it must supply its own `<html>`/`<body>` and must not depend on the
 * app stylesheet, so the styling here is inline. The digest correlates with the
 * server-side log entry; the underlying message is never shown to the user.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root render error", error.digest ?? error.name);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <main
          style={{
            maxWidth: "28rem",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "0.75rem", color: "#475569" }}>
            The application could not start. Please try again, or return to the
            dashboard.
          </p>
          {error.digest ? (
            <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#94a3b8" }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <div
            style={{
              marginTop: "1.25rem",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                border: 0,
                borderRadius: "0.5rem",
                background: "#4f46e5",
                color: "#fff",
                padding: "0.5rem 1rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{
                borderRadius: "0.5rem",
                border: "1px solid #cbd5e1",
                color: "#334155",
                padding: "0.5rem 1rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Dashboard
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
