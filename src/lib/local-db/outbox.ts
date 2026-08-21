import Dexie from "dexie";
import { localDb, type SyncOutboxRecord } from "./db";

const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_MS = 2_000;
const MAX_RETRY_MS = 5 * 60_000;

export interface CreateOutboxOperationInput {
  operationId: string;
  deviceId: string;
  restaurantId: string;
  entityType: string;
  entityId: string;
  operationType: string;
  baseVersion?: number;
  payload: unknown;
}

function retryDelay(attempt: number): number {
  return Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** Math.max(0, attempt - 1));
}

export async function enqueueOutboxOperation(input: CreateOutboxOperationInput): Promise<number> {
  const now = new Date().toISOString();
  const record: SyncOutboxRecord = {
    operationId: input.operationId, deviceId: input.deviceId, restaurantId: input.restaurantId,
    entityType: input.entityType, entityId: input.entityId, operationType: input.operationType,
    baseVersion: input.baseVersion, payload: JSON.stringify(input.payload), status: "PENDING",
    attemptCount: 0, nextRetryAt: null, lastError: null, createdAt: now, updatedAt: now, processedAt: null,
  };
  return localDb.syncOutbox.add(record);
}

export async function getPendingOutboxOperations(limit = 50): Promise<SyncOutboxRecord[]> {
  const now = new Date().toISOString();
  return localDb.syncOutbox
    .where("[status+createdAt]")
    .between(["PENDING", Dexie.minKey], ["PENDING", Dexie.maxKey])
    .filter((record) => !record.nextRetryAt || record.nextRetryAt <= now)
    .limit(Math.max(1, Math.min(limit, 100)))
    .toArray();
}

export async function getRetryableOutboxOperations(limit = 50): Promise<SyncOutboxRecord[]> {
  const now = new Date().toISOString();
  const failed = await localDb.syncOutbox.where("status").equals("FAILED")
    .filter((record) => record.attemptCount < MAX_RETRY_ATTEMPTS && (!record.nextRetryAt || record.nextRetryAt <= now))
    .limit(Math.max(1, Math.min(limit, 100))).toArray();
  const retrying = await localDb.syncOutbox.where("status").equals("RETRYING")
    .filter((record) => record.attemptCount < MAX_RETRY_ATTEMPTS && (!record.nextRetryAt || record.nextRetryAt <= now))
    .limit(Math.max(0, Math.min(limit - failed.length, 100))).toArray();
  return [...failed, ...retrying];
}

export async function prepareRetryableOutboxOperations(): Promise<void> {
  const operations = await getRetryableOutboxOperations(100);
  if (!operations.length) return;
  await localDb.transaction("rw", localDb.syncOutbox, async () => {
    for (const operation of operations) {
      if (operation.id === undefined) continue;
      await localDb.syncOutbox.update(operation.id, { status: "PENDING", updatedAt: new Date().toISOString() });
    }
  });
}

export async function markOutboxOperationSyncing(operationId: string): Promise<void> {
  await localDb.syncOutbox.where("operationId").equals(operationId).modify((record) => {
    record.status = "SYNCING";
    record.updatedAt = new Date().toISOString();
  });
}

export async function markOutboxOperationFailed(operationId: string, error: string, retryable = true): Promise<void> {
  await localDb.syncOutbox.where("operationId").equals(operationId).modify((record) => {
    const attemptCount = record.attemptCount + 1;
    const terminal = !retryable || attemptCount >= MAX_RETRY_ATTEMPTS;
    record.status = terminal ? "FAILED" : "RETRYING";
    record.attemptCount = attemptCount;
    record.lastError = error;
    record.nextRetryAt = terminal ? null : new Date(Date.now() + retryDelay(attemptCount)).toISOString();
    record.updatedAt = new Date().toISOString();
  });
}

export async function markOutboxOperationConflict(
  operationId: string,
  error: string,
): Promise<void> {
  await localDb.syncOutbox.where("operationId").equals(operationId).modify((record) => {
    record.status = "CONFLICT";
    record.lastError = error;
    record.nextRetryAt = null;
    record.updatedAt = new Date().toISOString();
  });
}

export async function markOutboxOperationProcessed(operationId: string): Promise<void> {
  const now = new Date().toISOString();
  await localDb.syncOutbox.where("operationId").equals(operationId).modify((record) => {
    record.status = "COMPLETED"; record.processedAt = now; record.updatedAt = now;
    record.lastError = null; record.nextRetryAt = null;
  });
}

export async function countPendingOutboxOperations(): Promise<number> {
  return localDb.syncOutbox.where("status").equals("PENDING").count();
}

export async function countSyncingOutboxOperations(): Promise<number> {
  const [syncing, retrying] = await Promise.all([
    localDb.syncOutbox.where("status").equals("SYNCING").count(),
    localDb.syncOutbox.where("status").equals("RETRYING").count(),
  ]);
  return syncing + retrying;
}

export async function countFailedOutboxOperations(): Promise<number> {
  const [failed, conflict] = await Promise.all([
    localDb.syncOutbox.where("status").equals("FAILED").count(),
    localDb.syncOutbox.where("status").equals("CONFLICT").count(),
  ]);
  return failed + conflict;
}

export function getMaxOutboxRetryAttempts(): number { return MAX_RETRY_ATTEMPTS; }

export async function recoverStaleOutboxOperations(staleMs = 5 * 60_000): Promise<number> {
  const staleBefore = Date.now() - staleMs;
  const syncing = await localDb.syncOutbox.where("status").equals("SYNCING").toArray();
  let recovered = 0;
  for (const operation of syncing) {
    if (operation.id === undefined) continue;
    const updatedAt = Date.parse(operation.updatedAt);
    if (Number.isNaN(updatedAt) || updatedAt > staleBefore) continue;
    await localDb.syncOutbox.update(operation.id, {
      status: operation.attemptCount >= MAX_RETRY_ATTEMPTS ? "FAILED" : "RETRYING",
      lastError: "Recovered stale syncing operation.",
      nextRetryAt: operation.attemptCount >= MAX_RETRY_ATTEMPTS ? null : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    recovered++;
  }
  return recovered;
}
