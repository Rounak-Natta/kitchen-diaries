import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  prisma,
} from "@/lib/prisma";

import {
  processSyncOperation,
} from "./process-sync-operation";

import {
  processSyncOperationRecord,
} from "./process-sync-operation-record";

vi.mock(
  "@/lib/prisma",
  () => ({
    prisma: {
      $transaction:
        vi.fn(),
    },
  }),
);

vi.mock(
  "./process-sync-operation",
  () => ({
    processSyncOperation:
      vi.fn(),
  }),
);

// ======================================================
// HELPERS
// ======================================================

function createTransactionMock() {
  return {
    syncOperation: {
      findUnique:
        vi.fn(),

      update:
        vi.fn(),
    },

    device: {
      update:
        vi.fn(),
    },
  };
}

function createProcessingOperation() {
  return {
    id:
      "sync-record-1",

    operationId:
      "operation-1",

    deviceId:
      "device-1",

    restaurantId:
      "restaurant-1",

    operationType:
      "CREATE",

    entityType:
      "ORDER",

    entityId:
      "order-1",

    status:
      "PROCESSING",

    requestPayload: {
      orderNumber:
        "ORD-001",
    },

    responsePayload:
      null,

    errorMessage:
      null,

    createdAt:
      new Date(),

    completedAt:
      null,

    updatedAt:
      new Date(),

    device: {
      id:
        "device-1",

      restaurantId:
        "restaurant-1",

      activatedById:
        "user-1",

      status:
        "ACTIVE",
    },
  };
}

// ======================================================
// TESTS
// ======================================================

describe(
  "process sync operation record",
  () => {
    beforeEach(
      () => {
        vi.clearAllMocks();
      },
    );

    // --------------------------------------------------
    // COMPLETED
    // --------------------------------------------------

    it(
      "processes a PROCESSING operation and marks it COMPLETED",
      async () => {
        const transaction =
          createTransactionMock();

        const operation =
          createProcessingOperation();

        transaction.syncOperation.findUnique.mockResolvedValue(
          operation,
        );

        transaction.syncOperation.update.mockResolvedValue(
          {},
        );

        transaction.device.update.mockResolvedValue(
          {},
        );

        vi.mocked(
          processSyncOperation,
        ).mockResolvedValue({
          status:
            "COMPLETED",

          response: {
            orderId:
              "order-1",
          },

          error:
            null,
        });

        vi.mocked(
          prisma.$transaction,
        ).mockImplementation(
          async (
            callback,
          ) => {
            return callback(
              transaction as never,
            );
          },
        );

        await processSyncOperationRecord(
          "operation-1",
        );

        expect(
          processSyncOperation,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          transaction.syncOperation.update,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              operationId:
                "operation-1",
            },

            data: expect.objectContaining({
              status:
                "COMPLETED",

              errorMessage:
                null,

              completedAt:
                expect.any(Date),
            }),
          }),
        );

        expect(
          transaction.device.update,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id:
                "device-1",
            },

            data: {
              lastSeenAt:
                expect.any(Date),
            },
          }),
        );
      },
    );

    // --------------------------------------------------
    // FAILED
    // --------------------------------------------------

    it(
      "marks the operation FAILED when processing fails",
      async () => {
        const transaction =
          createTransactionMock();

        const operation =
          createProcessingOperation();

        transaction.syncOperation.findUnique.mockResolvedValue(
          operation,
        );

        transaction.syncOperation.update.mockResolvedValue(
          {},
        );

        transaction.device.update.mockResolvedValue(
          {},
        );

        vi.mocked(
          processSyncOperation,
        ).mockResolvedValue({
          status:
            "FAILED",

          response:
            null,

          error:
            "Menu item unavailable.",
        });

        vi.mocked(
          prisma.$transaction,
        ).mockImplementation(
          async (
            callback,
          ) => {
            return callback(
              transaction as never,
            );
          },
        );

        await processSyncOperationRecord(
          "operation-1",
        );

        expect(
          transaction.syncOperation.update,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              operationId:
                "operation-1",
            },

            data: expect.objectContaining({
              status:
                "FAILED",

              errorMessage:
                "Menu item unavailable.",

              completedAt:
                expect.any(Date),
            }),
          }),
        );

        expect(
          transaction.device.update,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    // --------------------------------------------------
    // ALREADY COMPLETED
    // --------------------------------------------------

    it(
      "does nothing when the operation is already COMPLETED",
      async () => {
        const transaction =
          createTransactionMock();

        const operation = {
          ...createProcessingOperation(),

          status:
            "COMPLETED",
        };

        transaction.syncOperation.findUnique.mockResolvedValue(
          operation,
        );

        vi.mocked(
          prisma.$transaction,
        ).mockImplementation(
          async (
            callback,
          ) => {
            return callback(
              transaction as never,
            );
          },
        );

        await processSyncOperationRecord(
          "operation-1",
        );

        expect(
          processSyncOperation,
        ).not.toHaveBeenCalled();

        expect(
          transaction.syncOperation.update,
        ).not.toHaveBeenCalled();

        expect(
          transaction.device.update,
        ).not.toHaveBeenCalled();
      },
    );

    // --------------------------------------------------
    // NOT FOUND
    // --------------------------------------------------

    it(
      "throws when the operation does not exist",
      async () => {
        const transaction =
          createTransactionMock();

        transaction.syncOperation.findUnique.mockResolvedValue(
          null,
        );

        vi.mocked(
          prisma.$transaction,
        ).mockImplementation(
          async (
            callback,
          ) => {
            return callback(
              transaction as never,
            );
          },
        );

        await expect(
          processSyncOperationRecord(
            "missing-operation",
          ),
        ).rejects.toThrow(
          "Sync operation not found.",
        );

        expect(
          processSyncOperation,
        ).not.toHaveBeenCalled();
      },
    );
  },
);