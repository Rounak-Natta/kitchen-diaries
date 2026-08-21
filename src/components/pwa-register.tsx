"use client";

import { useEffect } from "react";

function isTrustedPwaContext(): boolean {
  if (window.isSecureContext) return true;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !isTrustedPwaContext()) return;

    let cancelled = false;

    void navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .then(async (registration) => {
        if (cancelled) return;

        // Check for an updated application shell without allowing the browser
        // HTTP cache to pin an old service worker indefinitely.
        await registration.update().catch(() => undefined);

        const waiting = registration.waiting;
        if (waiting) {
          waiting.postMessage({ type: "SKIP_WAITING" });
        }
      })
      .catch((error: unknown) => {
        // Registration failures are operationally useful in production while
        // avoiding any credential or request-body logging.
        console.error("PWA_SERVICE_WORKER_REGISTRATION_FAILED", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
