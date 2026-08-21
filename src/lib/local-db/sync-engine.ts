import {
  countFailedOutboxOperations,
  countPendingOutboxOperations,
  countSyncingOutboxOperations,
  recoverStaleOutboxOperations,
} from "./outbox";
import { coordinateSync } from "./sync-coordinator";
import { hydrateSnapshot } from "./snapshot";
import { getSyncMetadata, setSyncMetadata } from "./sync-state";

export type SyncEngineStatus = "IDLE" | "SYNCING" | "SUCCESS" | "ERROR" | "OFFLINE";

export interface SyncEngineState {
  status: SyncEngineStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  pendingCount: number;
  failedCount: number;
  syncingCount: number;
  isOnline: boolean;
}

type SyncListener = (state: SyncEngineState) => void;

let state: SyncEngineState = {
  status: "IDLE", lastSyncAt: null, lastError: null,
  pendingCount: 0, failedCount: 0, syncingCount: 0,
  // Deterministic initial snapshot prevents SSR/client hydration drift.
  // initialize() applies navigator.onLine after the app hydrates.
  isOnline: true,
};

const listeners = new Set<SyncListener>();
function notify() { const snapshot = { ...state }; listeners.forEach((listener) => listener(snapshot)); }
function updateState(partial: Partial<SyncEngineState>) { state = { ...state, ...partial }; notify(); }
function isOnline() { return typeof navigator === "undefined" ? true : navigator.onLine; }

async function refreshCounts() {
  const [pendingCount, failedCount, syncingCount] = await Promise.all([
    countPendingOutboxOperations(), countFailedOutboxOperations(), countSyncingOutboxOperations(),
  ]);
  updateState({ pendingCount, failedCount, syncingCount });
}

let syncPromise: Promise<void> | null = null;

async function runSync(): Promise<void> {
  const online = isOnline();
  updateState({ isOnline: online });
  if (!online) {
    await refreshCounts();
    updateState({ status: "OFFLINE" });
    return;
  }

  const persistedLastSync = await getSyncMetadata("lastSuccessfulSyncAt");
  updateState({ status: "SYNCING", lastError: null, lastSyncAt: persistedLastSync });
  try {
    await recoverStaleOutboxOperations();
    const lastSnapshot = await import("./db").then(({ localDb }) => localDb.syncMetadata.get("lastSnapshotAt"));
    const pendingBeforeSnapshot = await countPendingOutboxOperations();
    if (
      pendingBeforeSnapshot === 0 &&
      (!lastSnapshot?.value || Date.now() - Date.parse(lastSnapshot.value) > 5 * 60_000)
    ) {
      await hydrateSnapshot();
    }
    await coordinateSync();
    await refreshCounts();
    const successfulAt = new Date().toISOString();
    await setSyncMetadata("lastSuccessfulSyncAt", successfulAt);
    updateState({ status: "SUCCESS", lastSyncAt: successfulAt, lastError: null });
  } catch (error: unknown) {
    // Refreshing counters is useful, but it must not hide the original sync
    // failure when the local IndexedDB schema itself is the broken part.
    await refreshCounts().catch(() => undefined);

    const message = error instanceof Error ? error.message : "Synchronization failed.";
    updateState({ status: "ERROR", lastError: message });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("kd:user-bug", {
          detail: {
            source: "CLIENT_RUNTIME",
            error,
            metadata: {
              action: "BACKGROUND_SYNC",
              syncStatus: "ERROR",
              pendingCount: state.pendingCount,
              failedCount: state.failedCount,
            },
          },
        }),
      );
    }

    throw error;
  }
}

async function runWithSyncLock(): Promise<void> {
  if (typeof navigator !== "undefined" && "locks" in navigator) {
    const locks = navigator.locks;
    await locks.request(
      "kitchen-diaries-sync",
      { ifAvailable: true },
      async (lock) => {
        if (!lock) return;
        await runSync();
      },
    );
    return;
  }

  await runSync();
}

export async function sync(): Promise<void> {
  if (syncPromise) return syncPromise;
  syncPromise = runWithSyncLock();
  try {
    await syncPromise;
  } finally {
    syncPromise = null;
  }
}

let listenersInitialized = false;
export function initializeSyncEngineListeners() {
  if (listenersInitialized || typeof window === "undefined") return;
  listenersInitialized = true;
  window.addEventListener("online", () => { updateState({ isOnline: true }); void sync(); });
  window.addEventListener("offline", () => updateState({ isOnline: false, status: "OFFLINE" }));
}

export const syncEngine = {
  initialize: async () => {
    const persistedLastSync = await getSyncMetadata("lastSuccessfulSyncAt");
    updateState({
      isOnline: isOnline(),
      status: isOnline() ? "IDLE" : "OFFLINE",
      lastSyncAt: persistedLastSync,
    });
    await refreshCounts();
  },
  sync,
  getState: (): SyncEngineState => ({ ...state }),
  subscribe: (listener: SyncListener) => {
    listeners.add(listener);
    listener({ ...state });
    return () => listeners.delete(listener);
  },
};
