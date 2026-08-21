"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  syncEngine,
  type SyncEngineState,
} from "./sync-engine";

const initialState: SyncEngineState = {
  status: "IDLE",

  lastSyncAt:
    null,

  lastError:
    null,

  pendingCount: 0,
  failedCount: 0,
  syncingCount: 0,
  // Keep the server render and the first browser render identical.
  // The real browser connectivity state is applied after hydration by
  // syncEngine.subscribe()/initialize().
  isOnline: true,
};

export function useSyncStatus(): SyncEngineState {
  const [
    state,
    setState,
  ] =
    useState<SyncEngineState>(
      initialState,
    );

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe(setState);
    return () => {
      unsubscribe();
    };
  }, []);

  return state;
}