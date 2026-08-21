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
  LOCAL_DB_TABLES,
  runLocalTransaction,
} from "./transaction";

describe(
  "local database transactions",
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
      "commits multiple writes atomically",
      async () => {
        await runLocalTransaction(
          [
            LOCAL_DB_TABLES.SYNC_METADATA,
            LOCAL_DB_TABLES.SYNC_OUTBOX,
          ],
          async () => {
            await localDb.syncMetadata.put({
              key: "test-key",
              value: "test-value",
            });

            await localDb.syncOutbox.add({
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

              payload:
                JSON.stringify({
                  orderId:
                    "order-1",
                }),

              status:
                "PENDING",

              attemptCount:
                0,

              lastError:
                null,

              createdAt:
                new Date().toISOString(),

              updatedAt:
                new Date().toISOString(),

              processedAt:
                null,
            });
          },
        );

        const metadata =
          await localDb.syncMetadata.get(
            "test-key",
          );

        const outbox =
          await localDb.syncOutbox
            .where(
              "operationId",
            )
            .equals(
              "operation-1",
            )
            .first();

        expect(
          metadata?.value,
        ).toBe(
          "test-value",
        );

        expect(
          outbox?.entityId,
        ).toBe(
          "order-1",
        );
      },
    );

    it(
      "rolls back all writes when an operation fails",
      async () => {
        await expect(
          runLocalTransaction(
            [
              LOCAL_DB_TABLES.SYNC_METADATA,
              LOCAL_DB_TABLES.SYNC_OUTBOX,
            ],
            async () => {
              await localDb.syncMetadata.put({
                key:
                  "rollback-key",

                value:
                  "should-not-exist",
              });

              await localDb.syncOutbox.add({
                operationId:
                  "operation-rollback",

                deviceId:
                  "device-1",

                restaurantId:
                  "restaurant-1",

                entityType:
                  "ORDER",

                entityId:
                  "order-rollback",

                operationType:
                  "CREATE",

                payload:
                  JSON.stringify({}),

                status:
                  "PENDING",

                attemptCount:
                  0,

                lastError:
                  null,

                createdAt:
                  new Date().toISOString(),

                updatedAt:
                  new Date().toISOString(),

                processedAt:
                  null,
              });

              throw new Error(
                "Simulated transaction failure",
              );
            },
          ),
        ).rejects.toThrow(
          "Simulated transaction failure",
        );

        const metadata =
          await localDb.syncMetadata.get(
            "rollback-key",
          );

        const outbox =
          await localDb.syncOutbox
            .where(
              "operationId",
            )
            .equals(
              "operation-rollback",
            )
            .first();

        expect(
          metadata,
        ).toBeUndefined();

        expect(
          outbox,
        ).toBeUndefined();
      },
    );
  },
);