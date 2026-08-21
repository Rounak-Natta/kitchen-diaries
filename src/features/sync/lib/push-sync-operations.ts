import {
  Prisma,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

import {
  authorizeSyncDevice,
} from "./authorize-sync-device";

import {
  processSyncOperation,
} from "./process-sync-operation";

import type {
  SyncPushOperation,
} from "@/features/sync/validations/sync";

// ======================================================
// TYPES
// ======================================================

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

interface PushSyncContext {
  userId: string;
  restaurantId: string;
  role?: import("@prisma/client").Role;
}

// ======================================================
// JSON HELPER
// ======================================================

function toInputJson(
  value: unknown,
): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function syncErrorCode(message: string): string {
  if (message === "FORBIDDEN_SYNC_OPERATION") return "FORBIDDEN";
  if (message.startsWith("SYNC_CONFLICT:")) return "VERSION_CONFLICT";
  if (/not found/i.test(message)) return "NOT_FOUND";
  if (/invalid/i.test(message)) return "VALIDATION_ERROR";
  if (/unauthorized|inactive|forbidden/i.test(message)) return "AUTHORIZATION_ERROR";
  if (/insufficient stock/i.test(message)) return "INSUFFICIENT_STOCK";
  return "SYNC_PROCESSING_ERROR";
}


async function resolveOrderEntityId(
  operation: SyncPushOperation,
  context: PushSyncContext,
  deviceId: string,
): Promise<string> {
  if (
    operation.entityType !== "ORDER" ||
    operation.operationType !== "UPDATE"
  ) {
    return operation.entityId;
  }

  const payload =
    operation.payload && typeof operation.payload === "object" && !Array.isArray(operation.payload)
      ? operation.payload as Record<string, unknown>
      : {};

  const idempotencyKey =
    typeof payload.idempotencyKey === "string" && payload.idempotencyKey.trim()
      ? payload.idempotencyKey.trim()
      : null;

  // Preferred recovery path: an order that was already committed by an
  // earlier CREATE can always be found by its restaurant-scoped idempotency
  // key, even if the browser never received the CREATE response.
  if (idempotencyKey) {
    const existingOrder = await prisma.order.findUnique({
      where: {
        restaurantId_idempotencyKey: {
          restaurantId: context.restaurantId,
          idempotencyKey,
        },
      },
      select: { id: true },
    });

    if (existingOrder) return existingOrder.id;
  }

  // Backward compatibility for already-queued lifecycle operations from older
  // PWA builds: those records may only contain the local IndexedDB order id.
  // The completed CREATE sync record retains that local id in entityId and the
  // real PostgreSQL order id in responsePayload.
  const createOperation = await prisma.syncOperation.findFirst({
    where: {
      restaurantId: context.restaurantId,
      deviceId,
      entityType: "ORDER",
      entityId: operation.entityId,
      operationType: "CREATE",
      status: "COMPLETED",
    },
    orderBy: [
      { completedAt: "desc" },
      { createdAt: "desc" },
    ],
    select: { responsePayload: true },
  });

  const response =
    createOperation?.responsePayload &&
    typeof createOperation.responsePayload === "object" &&
    !Array.isArray(createOperation.responsePayload)
      ? createOperation.responsePayload as Record<string, unknown>
      : null;

  return typeof response?.orderId === "string"
    ? response.orderId
    : operation.entityId;
}

// ======================================================
// MAP EXISTING OPERATION
// ======================================================

function mapExistingOperation(
  operation: {
    operationId: string;

    status:
      | "PENDING"
      | "SYNCING"
      | "PROCESSING"
      | "RETRYING"
      | "COMPLETED"
      | "FAILED"
      | "CONFLICT";

    responsePayload:
      | Prisma.JsonValue
      | null;

    errorMessage:
      | string
      | null;
    conflictCode?: string | null;
  },
): SyncPushResult {
  return {
    operationId:
      operation.operationId,

    status:
      operation.status,

    duplicate:
      true,

    response:
      operation.responsePayload ??
      undefined,

    error:
      operation.errorMessage ??
      undefined,
  };
}

// ======================================================
// PUSH ONE OPERATION
// ======================================================

async function pushOneOperation(
  operation: SyncPushOperation,
  context: PushSyncContext,
): Promise<SyncPushResult> {
  // ----------------------------------------------------
  // RESTAURANT AUTHORIZATION
  // ----------------------------------------------------

  if (
    operation.restaurantId !==
    context.restaurantId
  ) {
    return {
      operationId:
        operation.operationId,

      status:
        "FAILED",

      duplicate:
        false,

      error:
        "Invalid restaurant.",
    };
  }

  // ----------------------------------------------------
  // DEVICE AUTHORIZATION
  // ----------------------------------------------------

  const device =
    await authorizeSyncDevice({
      deviceId:
        operation.deviceId,

      restaurantId:
        context.restaurantId,
    });

  if (!device) {
    return {
      operationId:
        operation.operationId,

      status:
        "FAILED",

      duplicate:
        false,

      error:
        "Invalid or inactive device.",
    };
  }

  const resolvedEntityId = await resolveOrderEntityId(
    operation,
    context,
    device.id,
  );

  // ----------------------------------------------------
  // IDEMPOTENCY CHECK
  // ----------------------------------------------------

  const existing =
    await prisma.syncOperation.findUnique({
      where: {
        operationId:
          operation.operationId,
      },

      select: {
        operationId:
          true,

        status:
          true,

        responsePayload:
          true,

        errorMessage:
          true,

        conflictCode:
          true,
      },
    });

  // ----------------------------------------------------
  // IDEMPOTENT RETRY / CONCURRENT REQUEST
  // ----------------------------------------------------

  if (existing) {
    if (
      existing.status === "COMPLETED" ||
      existing.status === "CONFLICT" ||
      existing.status === "SYNCING" ||
      existing.status === "PROCESSING" ||
      existing.status === "RETRYING"
    ) {
      return mapExistingOperation(existing);
    }
  }

  // ----------------------------------------------------
  // CREATE OR CLAIM FOR PROCESSING
  // ----------------------------------------------------

  try {
    return await prisma.$transaction(
      async (tx) => {
        let operationRecord:
          | { operationId: string; status: string }
          | null = null;

        if (existing?.status === "FAILED") {
          const claimed = await tx.syncOperation.updateMany({
            where: {
              operationId: operation.operationId,
              restaurantId: context.restaurantId,
              deviceId: device.id,
              status: "FAILED",
            },
            data: {
              status: "RETRYING",
              entityId: resolvedEntityId,
              requestPayload: toInputJson(operation.payload),
              retryCount: { increment: 1 },
              lastAttemptAt: new Date(),
            },
          });

          if (claimed.count === 0) {
            const current = await tx.syncOperation.findUnique({
              where: { operationId: operation.operationId },
              select: {
                operationId: true,
                status: true,
                responsePayload: true,
                errorMessage: true,
                conflictCode: true,
              },
            });
            if (current) return mapExistingOperation(current);
            throw new Error("SYNC_OPERATION_NOT_FOUND");
          }

          operationRecord = {
            operationId: operation.operationId,
            status: "RETRYING",
          };
        } else if (!existing) {
          operationRecord = await tx.syncOperation.create({
            data: {
              operationId: operation.operationId,
              deviceId: device.id,
              restaurantId: context.restaurantId,
              operationType: operation.operationType,
              baseVersion: operation.baseVersion,
              entityType: operation.entityType,
              entityId: resolvedEntityId,
              status: "SYNCING",
              retryCount: 1,
              lastAttemptAt: new Date(),
              requestPayload: toInputJson(operation.payload),
            },
            select: {
              operationId: true,
              status: true,
            },
          });
        } else {
          return mapExistingOperation(existing);
        }

        if (!operationRecord) {
          throw new Error("SYNC_OPERATION_CLAIM_FAILED");
        }

        const processed = await processSyncOperation(
          tx,
          {
            operationId: operationRecord.operationId,
            operationType: operation.operationType,
            baseVersion: operation.baseVersion,
            entityType: operation.entityType,
            entityId: resolvedEntityId,
            payload: operation.payload,
            restaurantId: context.restaurantId,
            userId: context.userId,
            ...(context.role ? { role: context.role } : {}),
          },
        );

        const now = new Date();

        if (processed.status === "COMPLETED") {
          await tx.syncOperation.update({
            where: { operationId: operationRecord.operationId },
            data: {
              status: "COMPLETED",
              responsePayload: processed.response === null
                ? Prisma.JsonNull
                : toInputJson(processed.response),
              resultVersion:
                processed.response &&
                typeof processed.response === "object" &&
                processed.response !== null &&
                typeof (processed.response as { version?: unknown }).version === "number"
                  ? (processed.response as { version: number }).version
                  : null,
              errorMessage: null,
              errorCode: null,
              conflictCode: null,
              conflictPayload: Prisma.JsonNull,
              completedAt: now,
            },
          });

          await tx.device.update({
            where: { id: device.id },
            data: { lastSeenAt: now },
          });

          return {
            operationId: operationRecord.operationId,
            status: "COMPLETED",
            duplicate: false,
            response: processed.response ?? undefined,
          };
        }

        const errorMessage = processed.error ?? "Sync operation failed.";
        const isConflict = errorMessage.startsWith("SYNC_CONFLICT:");
        await tx.syncOperation.update({
          where: { operationId: operationRecord.operationId },
          data: {
            status: isConflict ? "CONFLICT" : "FAILED",
            responsePayload: Prisma.JsonNull,
            errorMessage,
            errorCode: syncErrorCode(errorMessage),
            conflictCode: isConflict ? "VERSION_CONFLICT" : null,
            conflictPayload: isConflict
              ? toInputJson({
                  entityType: operation.entityType,
                  entityId: resolvedEntityId,
                  baseVersion: operation.baseVersion ?? null,
                })
              : Prisma.JsonNull,
            completedAt: now,
          },
        });

        await tx.device.update({
          where: { id: device.id },
          data: { lastSeenAt: now },
        });

        return {
          operationId: operationRecord.operationId,
          status: isConflict ? "CONFLICT" : "FAILED",
          duplicate: false,
          error: errorMessage,
        };
      },
      {
        // Prisma interactive transactions default to a short timeout. Offline
        // sync operations can legitimately perform several validated writes
        // (order + items + audit/notifications, billing + inventory, etc.).
        // Give one operation enough time to finish atomically instead of
        // expiring the transaction and throwing P2028 during the final status
        // update. Keep the timeout bounded so a broken operation cannot hold a
        // database connection indefinitely.
        maxWait: 15_000,
        timeout: 60_000,
      },
    );
  } catch (
    error: unknown
  ) {
    // --------------------------------------------------
    // EXPIRED INTERACTIVE TRANSACTION
    // --------------------------------------------------

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2028"
    ) {
      // A transaction timeout/closed transaction is transient. Do not turn a
      // single expired operation into a 500 for the entire sync batch. The
      // local outbox will back off and retry the same idempotent operation.
      return {
        operationId: operation.operationId,
        status: "FAILED",
        duplicate: false,
        error: "Temporary sync transaction timeout. The operation will be retried.",
      };
    }

    // --------------------------------------------------
    // IDEMPOTENCY RACE
    // --------------------------------------------------

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing =
        await prisma.syncOperation.findUnique({
          where: {
            operationId:
              operation.operationId,
          },

          select: {
            operationId:
              true,

            status:
              true,

            responsePayload:
              true,

            errorMessage:
              true,

            conflictCode:
              true,
          },
        });

      if (existing) {
        return mapExistingOperation(
          existing,
        );
      }
    }

    throw error;
  }
}

// ======================================================
// PUSH MULTIPLE OPERATIONS
// ======================================================

export async function pushSyncOperations(
  operations: SyncPushOperation[],
  context: PushSyncContext,
): Promise<SyncPushResult[]> {
  const results:
    SyncPushResult[] = [];

  for (
    const operation of operations
  ) {
    const result =
      await pushOneOperation(
        operation,
        context,
      );

    results.push(
      result,
    );
  }

  return results;
}