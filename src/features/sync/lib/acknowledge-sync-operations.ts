import {
  prisma,
} from "@/lib/prisma";

// ======================================================
// TYPES
// ======================================================

export interface AcknowledgeSyncOperationsOptions {
  operationIds: string[];

  deviceId: string;

  restaurantId: string;
}

export interface AcknowledgeSyncOperationsResult {
  acknowledged: string[];

  alreadyAcknowledged: string[];

  rejected: Array<{
    operationId: string;

    reason: string;
  }>;
}

// ======================================================
// ACKNOWLEDGE SYNC OPERATIONS
// ======================================================

export async function acknowledgeSyncOperations(
  options: AcknowledgeSyncOperationsOptions,
): Promise<AcknowledgeSyncOperationsResult> {
  // ----------------------------------------------------
  // NORMALIZE IDS
  // ----------------------------------------------------

  const operationIds =
    Array.from(
      new Set(
        options.operationIds
          .filter(
            (
              operationId,
            ) =>
              typeof operationId ===
                "string" &&
              operationId.trim()
                .length > 0,
          )
          .map(
            (
              operationId,
            ) =>
              operationId.trim(),
          ),
      ),
    );

  if (
    operationIds.length ===
    0
  ) {
    return {
      acknowledged: [],

      alreadyAcknowledged: [],

      rejected: [],
    };
  }

  // ----------------------------------------------------
  // LOAD OPERATIONS
  // ----------------------------------------------------

  const operations =
    await prisma.syncOperation.findMany({
      where: {
        operationId: {
          in:
            operationIds,
        },

        restaurantId:
          options.restaurantId,
      },

      select: {
        operationId:
          true,

        deviceId:
          true,

        restaurantId:
          true,

        status:
          true,

        acknowledgedAt:
          true,
      },
    });

  const operationMap =
    new Map(
      operations.map(
        (
          operation,
        ) => [
          operation.operationId,
          operation,
        ],
      ),
    );

  const acknowledged:
    string[] = [];

  const alreadyAcknowledged:
    string[] = [];

  const rejected:
    Array<{
      operationId: string;

      reason: string;
    }> = [];

  // ----------------------------------------------------
  // VALIDATE OPERATIONS
  // ----------------------------------------------------

  for (
    const operationId of
      operationIds
  ) {
    const operation =
      operationMap.get(
        operationId,
      );

    // ----------------------------------------------
    // NOT FOUND / WRONG RESTAURANT
    // ----------------------------------------------

    if (!operation) {
      rejected.push({
        operationId,

        reason:
          "Sync operation not found.",
      });

      continue;
    }

    // ----------------------------------------------
    // DEVICE OWNERSHIP
    // ----------------------------------------------

    if (
      operation.deviceId !==
      options.deviceId
    ) {
      rejected.push({
        operationId,

        reason:
          "Sync operation does not belong to this device.",
      });

      continue;
    }

    // ----------------------------------------------
    // RESTAURANT OWNERSHIP
    // ----------------------------------------------

    if (
      operation.restaurantId !==
      options.restaurantId
    ) {
      rejected.push({
        operationId,

        reason:
          "Sync operation does not belong to this restaurant.",
      });

      continue;
    }

    // ----------------------------------------------
    // ONLY COMPLETED / FAILED CAN BE ACKNOWLEDGED
    // ----------------------------------------------

    if (
      operation.status !==
        "COMPLETED" &&
      operation.status !==
        "FAILED"
    ) {
      rejected.push({
        operationId,

        reason:
          "Sync operation is not ready for acknowledgement.",
      });

      continue;
    }

    // ------------------------------------------------
    // ACKNOWLEDGEMENT
    // ------------------------------------------------

    if (operation.acknowledgedAt) {
      alreadyAcknowledged.push(operationId);
      continue;
    }

    acknowledged.push(operationId);
  }

  // ----------------------------------------------------
  // PERSIST ACKNOWLEDGEMENT
  // ----------------------------------------------------

  if (acknowledged.length > 0) {
    await prisma.syncOperation.updateMany({
      where: {
        operationId: { in: acknowledged },
        restaurantId: options.restaurantId,
        deviceId: options.deviceId,
        status: "COMPLETED",
        acknowledgedAt: null,
      },
      data: {
        acknowledgedAt: new Date(),
      },
    });
  }

  // ----------------------------------------------------
  // UPDATE DEVICE LAST SEEN
  // ----------------------------------------------------

  if (
    acknowledged.length >
      0
  ) {
    await prisma.device.updateMany({
      where: {
        id:
          options.deviceId,

        restaurantId:
          options.restaurantId,

        status:
          "ACTIVE",
      },

      data: {
        lastSeenAt:
          new Date(),
      },
    });
  }

  return {
    acknowledged,

    alreadyAcknowledged,

    rejected,
  };
}