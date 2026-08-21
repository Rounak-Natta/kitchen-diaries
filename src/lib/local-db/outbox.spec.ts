import "fake-indexeddb/auto";

import Dexie from "dexie";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  localDb,
} from "./db";

import {
  countPendingOutboxOperations,
  enqueueOutboxOperation,
  getPendingOutboxOperations,
  markOutboxOperationFailed,
  markOutboxOperationProcessed,
  markOutboxOperationSyncing,
} from "./outbox";

describe(
  "sync outbox",
  () => {
    beforeEach(
      async () => {
        if (
          localDb.isOpen()
        ) {
          localDb.close();
        }

        await Dexie.delete(
          localDb.name,
        );

        await localDb.open();
      },
    );

    afterEach(
      () => {
        localDb.close();
      },
    );

    it(
      "enqueues an operation",
      async () => {
        await enqueueOutboxOperation({
          operationId:
            "operation-1",

          deviceId:
            "device-1",

          restaurantId:
            "restaurant-1",

          entityType:
            "ORDER",

          entityId:
            "order-1",

          operationType:
            "CREATE",

          payload: {
            orderId:
              "order-1",
          },
        });

        const operations =
          await getPendingOutboxOperations();

        expect(
          operations,
        ).toHaveLength(1);

        expect(
          operations[0].operationId,
        ).toBe(
          "operation-1",
        );

        expect(
          JSON.parse(
            operations[0].payload,
          ),
        ).toEqual({
          orderId:
            "order-1",
        });
      },
    );

    it(
      "counts pending operations",
      async () => {
        await enqueueOutboxOperation({
          operationId:
            "operation-1",

          deviceId:
            "device-1",

          restaurantId:
            "restaurant-1",

          entityType:
            "ORDER",

          entityId:
            "order-1",

          operationType:
            "CREATE",

          payload: {},
        });

        await enqueueOutboxOperation({
          operationId:
            "operation-2",

          deviceId:
            "device-1",

          restaurantId:
            "restaurant-1",

          entityType:
            "ORDER",

          entityId:
            "order-2",

          operationType:
            "CREATE",

          payload: {},
        });

        expect(
          await countPendingOutboxOperations(),
        ).toBe(2);
      },
    );

    it(
      "moves an operation through sync states",
      async () => {
        await enqueueOutboxOperation({
          operationId:
            "operation-1",

          deviceId:
            "device-1",

          restaurantId:
            "restaurant-1",

          entityType:
            "ORDER",

          entityId:
            "order-1",

          operationType:
            "CREATE",

          payload: {},
        });

        await markOutboxOperationSyncing(
          "operation-1",
        );

        let record =
          await localDb.syncOutbox
            .where(
              "operationId",
            )
            .equals(
              "operation-1",
            )
            .first();

        expect(
          record?.status,
        ).toBe(
          "SYNCING",
        );

        await markOutboxOperationProcessed(
          "operation-1",
        );

        record =
          await localDb.syncOutbox
            .where(
              "operationId",
            )
            .equals(
              "operation-1",
            )
            .first();

        expect(
          record?.status,
        ).toBe(
          "COMPLETED",
        );

        expect(
          record?.processedAt,
        ).toEqual(
          expect.any(String),
        );
      },
    );

    it(
      "records failed operations",
      async () => {
        await enqueueOutboxOperation({
          operationId:
            "operation-1",

          deviceId:
            "device-1",

          restaurantId:
            "restaurant-1",

          entityType:
            "ORDER",

          entityId:
            "order-1",

          operationType:
            "CREATE",

          payload: {},
        });

        await markOutboxOperationFailed(
          "operation-1",
          "Network unavailable",
        );

        const record =
          await localDb.syncOutbox
            .where(
              "operationId",
            )
            .equals(
              "operation-1",
            )
            .first();

        expect(
          record?.status,
        ).toBe(
          "RETRYING",
        );

        expect(
          record?.attemptCount,
        ).toBe(1);

        expect(
          record?.lastError,
        ).toBe(
          "Network unavailable",
        );
      },
    );

    it(
      "rejects duplicate operation IDs locally",
      async () => {
        const input = {
          operationId: "operation-unique",
          deviceId: "device-1",
          restaurantId: "restaurant-1",
          entityType: "ORDER",
          entityId: "order-1",
          operationType: "CREATE",
          payload: {},
        };

        await enqueueOutboxOperation(input);

        await expect(
          enqueueOutboxOperation(input),
        ).rejects.toThrow();
      },
    );
  },
);