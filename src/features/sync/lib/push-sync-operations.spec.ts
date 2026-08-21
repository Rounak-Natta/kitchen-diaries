import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { prisma } from "@/lib/prisma";

import { authorizeSyncDevice } from "./authorize-sync-device";

import { processSyncOperation } from "./process-sync-operation";

import { pushSyncOperations } from "./push-sync-operations";

// ======================================================
// MOCKS
// ======================================================

vi.mock("@/lib/prisma", () => ({
  prisma: {
    syncOperation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },

    device: {
      update: vi.fn(),
    },

    $transaction: vi.fn(),
  },
}));

vi.mock("./authorize-sync-device", () => ({
  authorizeSyncDevice: vi.fn(),
}));

vi.mock("./process-sync-operation", () => ({
  processSyncOperation: vi.fn(),
}));

// ======================================================
// TEST DATA
// ======================================================

const operation = {
  operationId: "operation-1",
  deviceId: "device-1",
  restaurantId: "restaurant-1",
  entityType: "ORDER",
  entityId: "order-1",
  operationType: "CREATE",

  payload: {
    orderId: "order-1",
  },
};

const context = {
  userId: "user-1",
  restaurantId: "restaurant-1",
};

// ======================================================
// TRANSACTION MOCK
// ======================================================

function mockTransaction() {
  vi.mocked(prisma.$transaction).mockImplementation(
    async (callback) => {
      const tx = {
        syncOperation: {
          create:
            prisma.syncOperation.create,

          update:
            prisma.syncOperation.update,
        },

        device: {
          update:
            prisma.device.update,
        },
      };

      return callback(
        tx as never,
      );
    },
  );
}

// ======================================================
// DEFAULT MOCKS
// ======================================================

function setupDefaults() {
  vi.mocked(
    authorizeSyncDevice,
  ).mockResolvedValue({
    id: "device-1",
    restaurantId: "restaurant-1",
  });

  vi.mocked(
    prisma.syncOperation.findUnique,
  ).mockResolvedValue(null);

  vi.mocked(
    prisma.syncOperation.create,
  ).mockResolvedValue({
    operationId:
      "operation-1",

    status:
      "PROCESSING",
  } as never);

  vi.mocked(
    prisma.syncOperation.update,
  ).mockResolvedValue(
    {} as never,
  );

  vi.mocked(
    prisma.device.update,
  ).mockResolvedValue(
    {} as never,
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

  mockTransaction();
}

// ======================================================
// TESTS
// ======================================================

describe(
  "push sync operations",
  () => {
    beforeEach(
      () => {
        vi.clearAllMocks();

        setupDefaults();
      },
    );

    // ==================================================
    // CREATE
    // ==================================================

    it(
      "creates and processes a new sync operation",
      async () => {
        const results =
          await pushSyncOperations(
            [
              operation,
            ],

            context,
          );

        expect(
          results,
        ).toEqual([
          {
            operationId:
              "operation-1",

            status:
              "COMPLETED",

            duplicate:
              false,

            response: {
              orderId:
                "order-1",
            },
          },
        ]);

        expect(
          prisma.$transaction,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          prisma.syncOperation.create,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          prisma.syncOperation.create,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              operationId: "operation-1",
              deviceId: "device-1",
              restaurantId: "restaurant-1",
              operationType: "CREATE",
              entityType: "ORDER",
              entityId: "order-1",
              status: "SYNCING",
              retryCount: 1,
              lastAttemptAt: expect.any(Date),
              requestPayload: { orderId: "order-1" },
            }),
            select: {
              operationId: true,
              status: true,
            },
          }),
        );

        expect(
          processSyncOperation,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          processSyncOperation,
        ).toHaveBeenCalledWith(
          expect.anything(),

          {
            operationId:
              "operation-1",

            operationType:
              "CREATE",

            entityType:
              "ORDER",

            entityId:
              "order-1",

            payload:
              operation.payload,

            restaurantId:
              "restaurant-1",

            userId:
              "user-1",
          },
        );

        expect(
          prisma.syncOperation.update,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              operationId:
                "operation-1",
            },

            data:
              expect.objectContaining({
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
          prisma.device.update,
        ).toHaveBeenCalledWith({
          where: {
            id:
              "device-1",
          },

          data: {
            lastSeenAt:
              expect.any(Date),
          },
        });
      },
    );

    // ==================================================
    // DUPLICATE
    // ==================================================

    it(
      "returns an existing operation as duplicate",
      async () => {
        vi.mocked(
          prisma.syncOperation.findUnique,
        ).mockResolvedValue({
          operationId:
            "operation-1",

          status:
            "COMPLETED",

          responsePayload: {
            orderId:
              "order-1",
          },

          errorMessage:
            null,
        } as never);

        const results =
          await pushSyncOperations(
            [
              operation,
            ],

            context,
          );

        expect(
          results,
        ).toEqual([
          {
            operationId:
              "operation-1",

            status:
              "COMPLETED",

            duplicate:
              true,

            response: {
              orderId:
                "order-1",
            },
          },
        ]);

        expect(
          prisma.$transaction,
        ).not.toHaveBeenCalled();

        expect(
          prisma.syncOperation.create,
        ).not.toHaveBeenCalled();

        expect(
          processSyncOperation,
        ).not.toHaveBeenCalled();
      },
    );

    // ==================================================
    // INVALID RESTAURANT
    // ==================================================

    it(
      "rejects an invalid restaurant",
      async () => {
        const results =
          await pushSyncOperations(
            [
              {
                ...operation,

                restaurantId:
                  "restaurant-2",
              },
            ],

            context,
          );

        expect(
          results,
        ).toEqual([
          {
            operationId:
              "operation-1",

            status:
              "FAILED",

            duplicate:
              false,

            error:
              "Invalid restaurant.",
          },
        ]);

        expect(
          authorizeSyncDevice,
        ).not.toHaveBeenCalled();

        expect(
          prisma.syncOperation.findUnique,
        ).not.toHaveBeenCalled();

        expect(
          prisma.$transaction,
        ).not.toHaveBeenCalled();

        expect(
          processSyncOperation,
        ).not.toHaveBeenCalled();
      },
    );

    // ==================================================
    // INVALID DEVICE
    // ==================================================

    it(
      "rejects an invalid device",
      async () => {
        vi.mocked(
          authorizeSyncDevice,
        ).mockResolvedValue(
          null,
        );

        const results =
          await pushSyncOperations(
            [
              operation,
            ],

            context,
          );

        expect(
          results,
        ).toEqual([
          {
            operationId:
              "operation-1",

            status:
              "FAILED",

            duplicate:
              false,

            error:
              "Invalid or inactive device.",
          },
        ]);

        expect(
          prisma.syncOperation.findUnique,
        ).not.toHaveBeenCalled();

        expect(
          prisma.$transaction,
        ).not.toHaveBeenCalled();

        expect(
          processSyncOperation,
        ).not.toHaveBeenCalled();
      },
    );

    // ==================================================
    // PROCESSING FAILURE
    // ==================================================

    it(
      "marks the operation as failed when processing fails",
      async () => {
        vi.mocked(
          processSyncOperation,
        ).mockResolvedValue({
          status:
            "FAILED",

          response:
            null,

          error:
            "Order processing failed.",
        });

        const results =
          await pushSyncOperations(
            [
              operation,
            ],

            context,
          );

        expect(
          results,
        ).toEqual([
          {
            operationId:
              "operation-1",

            status:
              "FAILED",

            duplicate:
              false,

            error:
              "Order processing failed.",
          },
        ]);

        expect(
          prisma.syncOperation.update,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              operationId:
                "operation-1",
            },

            data:
              expect.objectContaining({
                status:
                  "FAILED",

                errorMessage:
                  "Order processing failed.",

                completedAt:
                  expect.any(Date),
              }),
          }),
        );

        expect(
          prisma.device.update,
        ).toHaveBeenCalledWith({
          where: {
            id:
              "device-1",
          },

          data: {
            lastSeenAt:
              expect.any(Date),
          },
        });
      },
    );
  },
);