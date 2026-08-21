import { localDb } from "./db";
import { rebindLocalNotification } from "./notifications";
import { getLocalSession } from "./session";
import {
  countPendingOutboxOperations,
  getPendingOutboxOperations,
  markOutboxOperationFailed,
  markOutboxOperationProcessed,
  markOutboxOperationConflict,
  markOutboxOperationSyncing,
  prepareRetryableOutboxOperations,
} from "./outbox";

import {
  hasAppliedSyncOperation,
  getSyncCursor,
  markSyncOperationApplied,
  saveSyncCursor,
} from "./sync-state";

// ======================================================
// TYPES
// ======================================================

export interface PullOperation {
  operationId: string;

  deviceId: string;
  restaurantId: string;

  operationType: string;

  entityType: string;
  entityId: string;

  status:
    | "COMPLETED"
    | "FAILED"
    | "CONFLICT";

  requestPayload: unknown;

  responsePayload: unknown;

  errorMessage:
    | string
    | null;

  errorCode:
    | string
    | null;

  conflictCode:
    | string
    | null;

  createdAt: string;

  completedAt:
    | string
    | null;
}

export interface SyncPushResult {
  operationId: string;

  status:
    | "PENDING"
    | "SYNCING"
    | "PROCESSING"
    | "RETRYING"
    | "COMPLETED"
    | "FAILED"
    | "CONFLICT";

  duplicate: boolean;

  response?: unknown;

  error?: string;
}

export interface SyncPullResult {
  operations:
    PullOperation[];

  nextCursor:
    | string
    | null;

  hasMore: boolean;
}

// ======================================================
// ORDER DEPENDENCY REPAIR
// ======================================================

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function repairQueuedOrderDependencies(): Promise<void> {
  const queued = await localDb.syncOutbox
    .toCollection()
    .filter((operation) =>
      operation.entityType === "ORDER" &&
      operation.operationType === "UPDATE" &&
      operation.status !== "COMPLETED" &&
      operation.status !== "CONFLICT"
    )
    .toArray();

  for (const operation of queued) {
    if (operation.id === undefined) continue;

    const localOrder = await localDb.orders
      .toCollection()
      .filter((order) =>
        order.id === operation.entityId ||
        order.serverOrderId === operation.entityId
      )
      .first();

    if (!localOrder) continue;

    let payload: Record<string, unknown>;
    try {
      payload = asObject(JSON.parse(operation.payload));
    } catch {
      payload = {};
    }

    const serverOrderId =
      typeof localOrder.serverOrderId === "string" && localOrder.serverOrderId
        ? localOrder.serverOrderId
        : null;
    const idempotencyKey =
      typeof localOrder.idempotencyKey === "string" && localOrder.idempotencyKey
        ? localOrder.idempotencyKey
        : null;

    const repairedPayload =
      idempotencyKey && typeof payload.idempotencyKey !== "string"
        ? { ...payload, idempotencyKey }
        : payload;

    const notFoundFailure =
      operation.status === "FAILED" &&
      /order was not found/i.test(operation.lastError ?? "");

    const entityChanged = Boolean(serverOrderId && operation.entityId !== serverOrderId);
    const payloadChanged = JSON.stringify(repairedPayload) !== operation.payload;

    if (!entityChanged && !payloadChanged && !notFoundFailure) continue;

    await localDb.syncOutbox.update(operation.id, {
      ...(serverOrderId ? { entityId: serverOrderId } : {}),
      ...(payloadChanged ? { payload: JSON.stringify(repairedPayload) } : {}),
      ...(notFoundFailure
        ? {
            status: "PENDING",
            attemptCount: 0,
            nextRetryAt: null,
            lastError: null,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    });
  }
}

async function bindQueuedOrderUpdates(
  localOrderId: string,
  serverOrderId: string,
  idempotencyKey?: string,
): Promise<void> {
  const operations = await localDb.syncOutbox
    .toCollection()
    .filter((operation) =>
      operation.entityType === "ORDER" &&
      operation.operationType === "UPDATE" &&
      operation.entityId === localOrderId &&
      operation.status !== "COMPLETED" &&
      operation.status !== "CONFLICT"
    )
    .toArray();

  for (const operation of operations) {
    if (operation.id === undefined) continue;

    let payload: Record<string, unknown>;
    try {
      payload = asObject(JSON.parse(operation.payload));
    } catch {
      payload = {};
    }

    if (idempotencyKey && typeof payload.idempotencyKey !== "string") {
      payload = { ...payload, idempotencyKey };
    }

    const wasNotFound = /order was not found/i.test(operation.lastError ?? "");

    await localDb.syncOutbox.update(operation.id, {
      entityId: serverOrderId,
      payload: JSON.stringify(payload),
      ...(wasNotFound
        ? {
            status: "PENDING",
            attemptCount: 0,
            nextRetryAt: null,
            lastError: null,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    });
  }
}

// ======================================================
// PUSH
// ======================================================

async function pushPendingOperationsBatch(): Promise<void> {
  // Repair legacy/stuck lifecycle operations before retry selection. This
  // preserves existing IndexedDB data and avoids asking restaurants to clear
  // their offline database after an app upgrade.
  await repairQueuedOrderDependencies();

  /*
   * First recover failed operations that
   * are still inside the retry limit.
   */
  await prepareRetryableOutboxOperations();

  const operations =
    await getPendingOutboxOperations(
      50,
    );

  if (
    operations.length ===
    0
  ) {
    return;
  }

  for (
    const operation of operations
  ) {
    await markOutboxOperationSyncing(
      operation.operationId,
    );
  }

  let response: Response;

  try {
    response =
      await fetch(
        "/api/sync/push",
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",

            accept:
              "application/json",
          },

          body:
            JSON.stringify({
              operations:
                operations.map(
                  (operation) => ({
                    operationId:
                      operation.operationId,

                    deviceId:
                      operation.deviceId,

                    restaurantId:
                      operation.restaurantId,

                    entityType:
                      operation.entityType,

                    entityId:
                      operation.entityId,

                    operationType:
                      operation.operationType,

                    baseVersion:
                      operation.baseVersion,

                    payload:
                      JSON.parse(
                        operation.payload,
                      ),
                  }),
                ),
            }),
        },
      );
  } catch {
    for (
      const operation of operations
    ) {
      await markOutboxOperationFailed(
        operation.operationId,
        "Network error.",
      );
    }

    throw new Error(
      "Unable to reach sync server.",
    );
  }

  if (!response.ok) {
    const body =
      await response
        .json()
        .catch(
          () => null,
        );

    const message =
      body?.error ??
      `Sync push failed with status ${response.status}.`;

    const retryable =
      response.status >= 500 ||
      response.status === 408 ||
      response.status === 409 ||
      response.status === 429;

    for (const operation of operations) {
      await markOutboxOperationFailed(operation.operationId, message, retryable);
    }

    throw new Error(message);
  }

  const body =
    (await response.json()) as {
      success: boolean;

      data?: {
        results:
          SyncPushResult[];
      };

      error?: string;
    };

  if (
    !body.success ||
    !body.data
  ) {
    throw new Error(
      body.error ??
        "Invalid sync push response.",
    );
  }

  const failedResults: string[] = [];
  const completedOperationIds: string[] = [];

  for (const result of body.data.results) {
    const localOperation = operations.find(
      (item) => item.operationId === result.operationId,
    );

    if (result.status === "COMPLETED") {
      if (
        localOperation?.entityType === "ORDER" &&
        localOperation.operationType === "CREATE" &&
        result.response &&
        typeof result.response === "object" &&
        result.response !== null
      ) {
        const response = result.response as { orderId?: unknown; orderNumber?: unknown };
        const localOrder = await localDb.orders.get(localOperation.entityId);
        if (localOrder) {
          const changedAt = new Date().toISOString();
          const serverOrderId =
            typeof response.orderId === "string"
              ? response.orderId
              : localOrder.serverOrderId;

          await localDb.orders.put({
            ...localOrder,
            serverOrderId,
            orderNumber: typeof response.orderNumber === "string" ? response.orderNumber : localOrder.orderNumber,
            updatedAt: changedAt,
          } as never);

          if (typeof serverOrderId === "string") {
            await bindQueuedOrderUpdates(
              localOrder.id,
              serverOrderId,
              typeof localOrder.idempotencyKey === "string"
                ? localOrder.idempotencyKey
                : undefined,
            );

            await rebindLocalNotification(
              `LOCAL:${localOrder.id}:V1:PENDING`,
              {
                dedupeKey: `ORDER:${serverOrderId}:V1:PENDING`,
                entityId: serverOrderId,
                updatedAt: changedAt,
              },
            );
          }
        }
      }

      if (
        localOperation?.entityType === "BILL" &&
        localOperation.operationType === "CREATE" &&
        result.response &&
        typeof result.response === "object" &&
        result.response !== null
      ) {
        const response = result.response as { billId?: unknown; billNumber?: unknown };
        const localBill = await localDb.bills.get(localOperation.entityId);
        if (localBill) {
          await localDb.bills.put({
            ...localBill,
            serverBillId: typeof response.billId === "string" ? response.billId : localBill.serverBillId,
            billNumber: typeof response.billNumber === "string" ? response.billNumber : localBill.billNumber,
            updatedAt: new Date().toISOString(),
          } as never);
        }
      }

      completedOperationIds.push(result.operationId);
      continue;
    }

    if (result.status === "CONFLICT") {
      await markOutboxOperationConflict(
        result.operationId,
        result.error ?? "Sync conflict detected.",
      );
      failedResults.push(result.error ?? "Sync conflict detected.");
      continue;
    }

    if (result.status === "FAILED") {
      const error = result.error ?? "Sync operation failed.";
      const retryable =
        !/^SYNC_CONFLICT:/.test(error) &&
        !/unavailable|invalid|unauthorized|forbidden/i.test(error);
      await markOutboxOperationFailed(result.operationId, error, retryable);
      failedResults.push(error);
      continue;
    }

    if (
      result.status === "PENDING" ||
      result.status === "SYNCING" ||
      result.status === "PROCESSING" ||
      result.status === "RETRYING"
    ) {
      await markOutboxOperationFailed(
        result.operationId,
        result.error ?? "Server is still processing this sync operation.",
        true,
      );
    }
  }

  // The server-side business transaction is durable before the client
  // acknowledges it. If ACK fails, operations intentionally remain SYNCING
  // and are safely replayed by operationId after stale-operation recovery.
  if (completedOperationIds.length > 0) {
    const session = await getLocalSession();
    const deviceId = session?.deviceId ?? operations[0]?.deviceId;

    if (!deviceId) {
      throw new Error("SYNC_DEVICE_ID_MISSING");
    }

    const ackResponse = await fetch("/api/sync/ack", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        operationIds: completedOperationIds,
        deviceId,
      }),
    });

    const ackBody = await ackResponse.json().catch(() => null);
    if (!ackResponse.ok || !ackBody?.success) {
      throw new Error(
        ackBody?.error ?? `Sync acknowledgement failed with status ${ackResponse.status}.`,
      );
    }

    const acknowledged = new Set<string>(
      Array.isArray(ackBody.data?.acknowledged)
        ? ackBody.data.acknowledged
        : [],
    );
    const alreadyAcknowledged = new Set<string>(
      Array.isArray(ackBody.data?.alreadyAcknowledged)
        ? ackBody.data.alreadyAcknowledged
        : [],
    );

    for (const operationId of completedOperationIds) {
      if (acknowledged.has(operationId) || alreadyAcknowledged.has(operationId)) {
        await markOutboxOperationProcessed(operationId);
      } else {
        throw new Error(`SYNC_ACK_REJECTED:${operationId}`);
      }
    }
  }

}

// ======================================================
// PUSH ALL AVAILABLE OPERATIONS
// ======================================================

export async function pushPendingOperations(): Promise<void> {
  // Drain the outbox in deterministic creation order. A successful batch
  // never gets replayed locally because completion is committed only after ACK.
  while (true) {
    const pending = await countPendingOutboxOperations();
    if (pending === 0) return;
    await pushPendingOperationsBatch();
  }
}

// ======================================================
// APPLY PULLED OPERATION
// ======================================================

export async function applyPulledOperation(
  operation: PullOperation,
): Promise<void> {
  const alreadyApplied = await hasAppliedSyncOperation(operation.operationId);
  if (alreadyApplied) return;

  // Failed/conflicted server operations are diagnostics only; they must never
  // mutate the local business records.
  if (operation.status !== "COMPLETED") {
    await markSyncOperationApplied(operation.operationId);
    return;
  }

  await localDb.transaction(
    "rw",
    localDb.syncAppliedOperations,
    localDb.syncMetadata,
    localDb.syncEntities,
    async () => {
      const payload = operation.responsePayload ?? operation.requestPayload;

      if (operation.entityType === "ORDER" && operation.operationType === "CREATE") {
        const request = asObject(operation.requestPayload);
        const response = asObject(operation.responsePayload);
        const idempotencyKey =
          typeof request.idempotencyKey === "string" ? request.idempotencyKey : null;
        const serverOrderId =
          typeof response.orderId === "string" ? response.orderId : null;

        const matching = await localDb.orders
          .toCollection()
          .filter((order) =>
            order.id === operation.entityId ||
            (idempotencyKey !== null && order.idempotencyKey === idempotencyKey)
          )
          .first();

        if (matching && serverOrderId) {
          const changedAt = new Date().toISOString();
          await localDb.orders.put({
            ...matching,
            serverOrderId,
            ...(typeof response.orderNumber === "string"
              ? { orderNumber: response.orderNumber }
              : {}),
            updatedAt: changedAt,
          } as never);

          await bindQueuedOrderUpdates(
            matching.id,
            serverOrderId,
            typeof matching.idempotencyKey === "string"
              ? matching.idempotencyKey
              : undefined,
          );
        }
      }

      if (operation.entityType === "ORDER" && operation.operationType === "UPDATE") {
        const matching = await localDb.orders.toCollection().filter((order) =>
          order.id === operation.entityId || order.serverOrderId === operation.entityId
        ).first();
        if (matching && payload && typeof payload === "object") {
          const remote = payload as Record<string, unknown>;
          const changedAt = new Date().toISOString();
          const nextServerOrderId =
            typeof remote.id === "string"
              ? remote.id
              : matching.serverOrderId;

          const timestampPatch =
            remote.status === "CONFIRMED"
              ? { confirmedAt: changedAt }
              : remote.status === "PREPARING"
                ? { preparingAt: changedAt }
                : remote.status === "READY"
                  ? { readyAt: changedAt }
                  : remote.status === "CANCELLED"
                    ? {
                        cancelledAt: changedAt,
                        ...(typeof remote.cancellationReason === "string"
                          ? { cancellationReason: remote.cancellationReason }
                          : {}),
                      }
                    : {};

          await localDb.orders.put({
            ...matching,
            serverOrderId: nextServerOrderId,
            ...(typeof remote.status === "string" ? { status: remote.status } : {}),
            ...(typeof remote.version === "number" ? { version: remote.version } : {}),
            ...timestampPatch,
            updatedAt: changedAt,
          } as never);

          if (typeof remote.id === "string" && typeof remote.version === "number" && typeof remote.status === "string") {
            await rebindLocalNotification(
              `LOCAL:${matching.id}:V${remote.version}:${remote.status}`,
              {
                dedupeKey: `ORDER:${remote.id}:V${remote.version}:${remote.status}`,
                entityId: remote.id,
                updatedAt: changedAt,
              },
            );
          }
        }
      }

      if (operation.entityType === "BILL" && operation.operationType === "ADD_PAYMENT") {
        const matching = await localDb.bills.toCollection().filter((bill) =>
          bill.id === operation.entityId || bill.serverBillId === operation.entityId
        ).first();
        if (matching && payload && typeof payload === "object") {
          const remote = payload as Record<string, unknown>;
          const response = operation.responsePayload;
          const result = response && typeof response === "object" ? response as Record<string, unknown> : {};
          await localDb.bills.put({
            ...matching,
            ...(typeof result.dueAmount === "string" ? { dueAmount: Number(result.dueAmount) } : {}),
            ...(typeof remote.tenderedAmount === "number"
              ? { amountPaid: Number(matching.amountPaid ?? 0) + Number(result.amount ?? remote.tenderedAmount) }
              : {}),
            paymentStatus:
              Number(result.dueAmount ?? matching.dueAmount ?? 0) <= 0 ? "PAID" : "PARTIAL",
            version: Number(matching.version ?? 1) + 1,
            updatedAt: new Date().toISOString(),
          } as never);
        }
      }

      if (operation.entityType === "BILL" && operation.operationType === "REFUND") {
        const matching = await localDb.bills.toCollection().filter((bill) =>
          bill.id === operation.entityId || bill.serverBillId === operation.entityId
        ).first();
        if (matching && payload && typeof payload === "object") {
          const result = operation.responsePayload;
          const remote = result && typeof result === "object" ? result as Record<string, unknown> : {};
          const amount = Number(remote.refundedAmount ?? matching.refundedAmount ?? 0);
          await localDb.bills.put({
            ...matching,
            refundedAmount: amount,
            status: Number(remote.refundableAmount ?? 1) <= 0 ? "REFUNDED" : "PARTIALLY_REFUNDED",
            paymentStatus: Number(remote.refundableAmount ?? 1) <= 0 ? "REFUNDED" : "PARTIALLY_REFUNDED",
            version: Number(matching.version ?? 1) + 1,
            updatedAt: new Date().toISOString(),
          } as never);
        }
      }

      if (operation.entityType === "BILL" && operation.operationType === "CANCEL") {
        const matching = await localDb.bills.toCollection().filter((bill) =>
          bill.id === operation.entityId || bill.serverBillId === operation.entityId
        ).first();
        if (matching) {
          await localDb.bills.put({
            ...matching,
            status: "CANCELLED",
            paymentStatus: "PENDING",
            dueAmount: 0,
            updatedAt: new Date().toISOString(),
          } as never);
          const order = await localDb.orders.get(matching.orderId);
          if (order) {
            await localDb.orders.put({
              ...order,
              status: "CANCELLED",
              updatedAt: new Date().toISOString(),
            } as never);
          }
        }
      }

      await localDb.syncEntities.put({
        id: operation.operationId,
        restaurantId: operation.restaurantId,
        entityType: operation.entityType,
        entityId: operation.entityId,
        operationType: operation.operationType,
        payload: JSON.stringify(payload ?? null),
        serverOperationId: operation.operationId,
        createdAt: operation.createdAt,
        updatedAt: operation.completedAt ?? operation.createdAt,
      });
      await markSyncOperationApplied(operation.operationId);
    },
  );
}

// ======================================================
// PULL ONE PAGE
// ======================================================

export async function pullOperations(
  cursor?: string,
): Promise<SyncPullResult> {
  const params =
    new URLSearchParams();

  params.set(
    "limit",
    "100",
  );

  if (cursor) {
    params.set(
      "cursor",
      cursor,
    );
  }

  const session = await getLocalSession();

  const response =
    await fetch(
      `/api/sync/pull?${params.toString()}`,
      {
        method:
          "GET",

        headers: {
          accept:
            "application/json",
          ...(session?.deviceId
            ? { "x-device-id": session.deviceId }
            : {}),
        },
      },
    );

  if (!response.ok) {
    const body =
      await response
        .json()
        .catch(
          () => null,
        );

    throw new Error(
      body?.error ??
        `Sync pull failed with status ${response.status}.`,
    );
  }

  const body =
    (await response.json()) as {
      success: boolean;

      data?: SyncPullResult;

      error?: string;
    };

  if (
    !body.success ||
    !body.data
  ) {
    throw new Error(
      body.error ??
        "Invalid sync pull response.",
    );
  }

  for (
    const operation of
      body.data.operations
  ) {
    await applyPulledOperation(
      operation,
    );
  }

  /*
   * Advance cursor only after all
   * operations in this page succeeded.
   */
  if (
    body.data.nextCursor
  ) {
    await saveSyncCursor(
      body.data.nextCursor,
    );
  }

  return body.data;
}

// ======================================================
// FULL SYNC COORDINATION
// ======================================================

export async function coordinateSync(): Promise<void> {
  /*
   * PUSH local changes first.
   */
  await pushPendingOperations();

  /*
   * Then pull server changes.
   */
  let cursor =
    (await getSyncCursor()) ??
    undefined;

  while (true) {
    const result =
      await pullOperations(
        cursor,
      );

    if (
      !result.hasMore
    ) {
      break;
    }

    if (
      !result.nextCursor
    ) {
      break;
    }

    cursor =
      result.nextCursor;
  }
}