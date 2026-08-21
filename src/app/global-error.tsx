"use client";

import { useEffect } from "react";

import { reportUserBug } from "@/components/observability/bug-reporter";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportUserBug("NEXT_GLOBAL_ERROR", error, {
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 460, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
            <h1 style={{ fontSize: 22, margin: 0 }}>Kitchen Diaries needs to recover</h1>
            <p style={{ color: "#64748b", lineHeight: 1.6 }}>
              The error was recorded for support. Restart this screen to continue.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ border: 0, borderRadius: 12, padding: "10px 16px", background: "#0f172a", color: "white", fontWeight: 700 }}
            >
              Restart screen
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
