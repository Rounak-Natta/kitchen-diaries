"use client";

import { useEffect } from "react";
import { initializeSync, runSync } from "@/lib/local-db/sync-bootstrap";

export function SyncBootstrap() {
  useEffect(() => {
    void initializeSync().catch(() => undefined);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void runSync().catch(() => undefined);
    };

    window.addEventListener("online", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);

    const interval = window.setInterval(() => {
      void runSync().catch(() => undefined);
    }, 60_000);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
