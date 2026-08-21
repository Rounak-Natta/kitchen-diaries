import { prisma } from "@/lib/prisma";
import { encodeSyncCursor, decodeSyncCursor } from "@/lib/local-db/sync-cursor";

// ======================================================
// TYPES
// ======================================================

export interface PullSyncOptions {
  restaurantId: string;
  cursor?: string;
  limit?: number;
}

export interface PullSyncOperation {
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

  createdAt: Date;

  completedAt:
    | Date
    | null;
}

export interface PullSyncResult {
  operations: PullSyncOperation[];

  nextCursor:
    | string
    | null;

  hasMore: boolean;
}

// ======================================================
// PULL
// ======================================================

export async function pullSyncOperations(
  options: PullSyncOptions,
): Promise<PullSyncResult> {
  const limit =
    Math.min(
      Math.max(
        options.limit ?? 100,
        1,
      ),
      500,
    );

  const operations =
    await prisma.syncOperation.findMany({
      where: {
        restaurantId:
          options.restaurantId,

        status: "COMPLETED",

        ...(options.cursor
          ? (() => {
              const decoded = decodeSyncCursor(options.cursor);
              if (!decoded) return {};
              const updatedAt = new Date(decoded.createdAt);
              return {
                OR: [
                  { updatedAt: { gt: updatedAt } },
                  { updatedAt, id: { gt: decoded.id } },
                ],
              };
            })()
          : {}),
      },

      orderBy: [
        {
          updatedAt:
            "asc",
        },

        {
          id:
            "asc",
        },
      ],

      take:
        limit + 1,

      select: {
        id: true,
        operationId:
          true,

        deviceId:
          true,

        restaurantId:
          true,

        operationType:
          true,

        entityType:
          true,

        entityId:
          true,

        status:
          true,

        requestPayload:
          true,

        responsePayload:
          true,

        errorMessage:
          true,

        errorCode:
          true,

        conflictCode:
          true,

        createdAt:
          true,

        completedAt:
          true,

        updatedAt:
          true,
      },
    });

  const hasMore =
    operations.length >
    limit;

  const page =
    hasMore
      ? operations.slice(
          0,
          limit,
        )
      : operations;

  const last =
    page.at(-1);

  return {
    operations:
      page.map(
        (operation) => ({
          operationId:
            operation.operationId,

          deviceId:
            operation.deviceId,

          restaurantId:
            operation.restaurantId,

          operationType:
            operation.operationType,

          entityType:
            operation.entityType,

          entityId:
            operation.entityId,

          status:
            operation.status === "COMPLETED"
              ? "COMPLETED"
              : operation.status === "CONFLICT"
                ? "CONFLICT"
                : "FAILED",

          requestPayload:
            operation.requestPayload,

          responsePayload:
            operation.responsePayload,

          errorMessage:
            operation.errorMessage,

          errorCode:
            operation.errorCode,

          conflictCode:
            operation.conflictCode,

          createdAt:
            operation.createdAt,

          completedAt:
            operation.completedAt,
        }),
      ),

    nextCursor:
      last
        ? encodeSyncCursor({
            createdAt: last.updatedAt.toISOString(),
            id: last.id,
          })
        : options.cursor ?? null,

    hasMore,
  };
}