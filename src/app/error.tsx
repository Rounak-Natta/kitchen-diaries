"use client";

import { useEffect } from "react";

import { reportUserBug } from "@/components/observability/bug-reporter";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportUserBug("NEXT_ERROR_BOUNDARY", error, {
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The issue was recorded for support. Your local restaurant data has not been cleared.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
