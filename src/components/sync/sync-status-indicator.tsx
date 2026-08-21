"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, CloudOff, Loader2, RefreshCw, TriangleAlert, Clock3 } from "lucide-react";
import { useSyncStatus } from "@/lib/local-db/use-sync-status";
import { runSync } from "@/lib/local-db/sync-bootstrap";

export function SyncStatusIndicator() {
  const state = useSyncStatus();
  const [retrying, setRetrying] = useState(false);
  const browserOnline = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("online", onStoreChange);
      window.addEventListener("offline", onStoreChange);
      return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );

  const online = browserOnline && state.isOnline;
  const config = !online
    ? { label: "Offline", icon: CloudOff }
    : state.status === "SYNCING"
      ? { label: "Syncing", icon: Loader2 }
      : state.status === "ERROR"
        ? { label: "Sync failed", icon: TriangleAlert }
        : state.pendingCount > 0
          ? { label: "Pending sync", icon: Clock3 }
          : state.lastSyncAt
            ? { label: "Synced", icon: Check }
            : { label: "Not synced", icon: Clock3 };

  const Icon = config.icon;
  const canRetry = online && (state.status === "ERROR" || state.failedCount > 0 || state.pendingCount > 0);

  async function retry() {
    if (retrying || !online) return;
    setRetrying(true);
    try { await runSync(); } finally { setRetrying(false); }
  }

  return (
    <button
      type="button"
      onClick={canRetry ? retry : undefined}
      className="group flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm transition hover:bg-muted disabled:cursor-default"
      title={
        !online
          ? `Offline · Pending ${state.pendingCount} · Failed ${state.failedCount}`
          : `${state.lastError ? `Error: ${state.lastError} · ` : ""}Pending ${state.pendingCount} · Failed ${state.failedCount} · Last sync ${state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleTimeString() : "never"}`
      }
    >
      <Icon className={`size-3.5 ${state.status === "SYNCING" || retrying ? "animate-spin" : ""}`} />
      <span>{config.label}</span>
      {state.pendingCount > 0 && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{state.pendingCount}</span>}
      {state.failedCount > 0 && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">{state.failedCount}</span>}
      {canRetry && <RefreshCw className="size-3 opacity-60 transition group-hover:opacity-100" />}
    </button>
  );
}
