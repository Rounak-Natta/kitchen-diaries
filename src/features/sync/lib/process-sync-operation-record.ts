import {
  Prisma,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

import {
  processSyncOperation,
} from "./process-sync-operation";

// ======================================================
// PROCESS SYNC OPERATION RECORD
// ======================================================

export async function processSyncOperationRecord(
  operationId: string,
): Promise<void> {
  await prisma.$transaction(
    async (
      transaction,
    ) => {
      // ------------------------------------------------
      // LOAD OPERATION
      // ------------------------------------------------

      const operation =
        await transaction.syncOperation.findUnique(
          {
            where: {
              operationId,
            },

            include: {
              device: {
                select: {
                  id: true,

                  restaurantId: true,

                  activatedById: true,

                  status: true,
                },
              },
            },
          },
        );

      // ------------------------------------------------
      // NOT FOUND
      // ------------------------------------------------

      if (!operation) {
        throw new Error(
          "Sync operation not found.",
        );
      }

      // ------------------------------------------------
      // IDEMPOTENCY
      // ------------------------------------------------

      if (
        operation.status ===
        "COMPLETED"
      ) {
        return;
      }

      // ------------------------------------------------
      // ALREADY FAILED
      // ------------------------------------------------

      if (
        operation.status ===
          "FAILED" ||
        operation.status ===
          "CONFLICT"
      ) {
        return;
      }

      // ------------------------------------------------
      // DEVICE VALIDATION
      // ------------------------------------------------

      if (
        operation.device.restaurantId !==
        operation.restaurantId
      ) {
        await transaction.syncOperation.update(
          {
            where: {
              operationId:
                operation.operationId,
            },

            data: {
              status:
                "FAILED",

              errorCode:
                "AUTHORIZATION_ERROR",

              responsePayload:
                Prisma.JsonNull,

              errorMessage:
                "Sync device does not belong to the operation restaurant.",

              completedAt:
                new Date(),
            },
          },
        );

        return;
      }

      if (
        operation.device.status !==
        "ACTIVE"
      ) {
        await transaction.syncOperation.update(
          {
            where: {
              operationId:
                operation.operationId,
            },

            data: {
              status:
                "FAILED",

              errorCode:
                "AUTHORIZATION_ERROR",

              responsePayload:
                Prisma.JsonNull,

              errorMessage:
                "Sync device is not active.",

              completedAt:
                new Date(),
            },
          },
        );

        return;
      }

      // ------------------------------------------------
      // USER VALIDATION
      // ------------------------------------------------

      const userId =
        operation.device.activatedById;

      if (!userId) {
        await transaction.syncOperation.update(
          {
            where: {
              operationId:
                operation.operationId,
            },

            data: {
              status:
                "FAILED",

              errorCode:
                "AUTHORIZATION_ERROR",

              responsePayload:
                Prisma.JsonNull,

              errorMessage:
                "Sync device has no activating user.",

              completedAt:
                new Date(),
            },
          },
        );

        return;
      }

      // ------------------------------------------------
      // PROCESS BUSINESS OPERATION
      // ------------------------------------------------

      const result =
        await processSyncOperation(
          transaction,
          {
            operationId:
              operation.operationId,

            operationType:
              operation.operationType,

            entityType:
              operation.entityType,

            entityId:
              operation.entityId,

            payload:
              operation.requestPayload,

            restaurantId:
              operation.restaurantId,

            userId,
          },
        );

      // ------------------------------------------------
      // SUCCESS
      // ------------------------------------------------

      if (
        result.status ===
        "COMPLETED"
      ) {
        await transaction.syncOperation.update(
          {
            where: {
              operationId:
                operation.operationId,
            },

            data: {
              status:
                "COMPLETED",

              responsePayload:
                result.response ===
                null
                  ? Prisma.JsonNull
                  : (result.response as Prisma.InputJsonValue),

              errorMessage:
                null,

              errorCode:
                null,

              completedAt:
                new Date(),
            },
          },
        );

        // ----------------------------------------------
        // DEVICE LAST SEEN
        // ----------------------------------------------

        await transaction.device.update(
          {
            where: {
              id:
                operation.device.id,
            },

            data: {
              lastSeenAt:
                new Date(),
            },
          },
        );

        return;
      }

      // ------------------------------------------------
      // FAILURE
      // ------------------------------------------------

      await transaction.syncOperation.update(
        {
          where: {
            operationId:
              operation.operationId,
          },

          data: {
            status:
              result.error?.startsWith("SYNC_CONFLICT:")
                ? "CONFLICT"
                : "FAILED",

            errorCode:
              result.error?.startsWith("SYNC_CONFLICT:")
                ? "VERSION_CONFLICT"
                : "SYNC_PROCESSING_ERROR",

            responsePayload:
              Prisma.JsonNull,

            errorMessage:
              result.error ??
              "Sync operation failed.",

            completedAt:
              new Date(),
          },
        },
      );

      // ------------------------------------------------
      // DEVICE LAST SEEN
      // ------------------------------------------------

      await transaction.device.update(
        {
          where: {
            id:
              operation.device.id,
          },

          data: {
            lastSeenAt:
              new Date(),
          },
        },
      );
    },
  );
}