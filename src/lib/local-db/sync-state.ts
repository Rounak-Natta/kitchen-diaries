import { localDb, type SyncCursorRecord, type SyncMetadataRecord } from "./db";

const APPLIED_OPERATION_PREFIX = "sync:applied:";

export async function getSyncCursor(): Promise<string | null> {
  return (await localDb.syncCursor.get("default"))?.cursor ?? null;
}

export async function setSyncCursor(cursor: string | null): Promise<void> {
  const record: SyncCursorRecord = { id: "default", cursor, updatedAt: new Date().toISOString() };
  await localDb.syncCursor.put(record);
}
export const saveSyncCursor = setSyncCursor;

export async function getSyncMetadata(key: string): Promise<string | null> {
  return (await localDb.syncMetadata.get(key))?.value ?? null;
}
export async function setSyncMetadata(key: string, value: string): Promise<void> {
  const record: SyncMetadataRecord = { key, value };
  await localDb.syncMetadata.put(record);
}

function appliedOperationKey(operationId: string) { return `${APPLIED_OPERATION_PREFIX}${operationId}`; }

export async function hasAppliedSyncOperation(operationId: string): Promise<boolean> {
  const record = await localDb.syncAppliedOperations.get(operationId);
  if (record) return true;
  // Backward compatibility with v2 metadata markers.
  return (await getSyncMetadata(appliedOperationKey(operationId))) === "1";
}

export async function markSyncOperationApplied(operationId: string): Promise<void> {
  await localDb.syncAppliedOperations.put({ operationId, appliedAt: new Date().toISOString() });
  await setSyncMetadata(appliedOperationKey(operationId), "1");
}
