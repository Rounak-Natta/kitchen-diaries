import {
  localDb,
} from "./db";

const CURSOR_ID =
  "default";

export async function getSyncCursor(): Promise<string | null> {
  const record =
    await localDb.syncCursor.get(
      CURSOR_ID,
    );

  return record?.cursor ?? null;
}

export async function saveSyncCursor(
  cursor: string,
): Promise<void> {
  await localDb.syncCursor.put({
    id: CURSOR_ID,

    cursor,

    updatedAt:
      new Date().toISOString(),
  });
}

export async function clearSyncCursor(): Promise<void> {
  await localDb.syncCursor.delete(
    CURSOR_ID,
  );
}