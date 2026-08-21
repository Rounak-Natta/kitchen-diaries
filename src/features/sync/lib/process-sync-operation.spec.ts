import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  processCreateOrder,
} from "./process-create-order";

import {
  processSyncOperation,
} from "./process-sync-operation";

vi.mock(
  "./process-create-order",
  () => ({
    processCreateOrder:
      vi.fn(),
  }),
);

describe(
  "process sync operation",
  () => {
    beforeEach(
      () => {
        vi.clearAllMocks();
      },
    );

    it(
      "processes CREATE ORDER successfully",
      async () => {
        vi.mocked(
          processCreateOrder,
        ).mockResolvedValue({
          orderId:
            "order-1",
        } as never);

        const result =
          await processSyncOperation(
            {} as never,
            {
              operationId:
                "operation-1",

              operationType:
                "CREATE",

              entityType:
                "ORDER",

              entityId:
                "order-1",

              payload: {
                orderNumber:
                  "ORD-001",
              },

              restaurantId:
                "restaurant-1",

              userId:
                "user-1",
            },
          );

        expect(
          result,
        ).toEqual({
          status:
            "COMPLETED",

          response: {
            orderId:
              "order-1",
          },

          error:
            null,
        });

        expect(
          processCreateOrder,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      "returns FAILED when processing fails",
      async () => {
        vi.mocked(
          processCreateOrder,
        ).mockRejectedValue(
          new Error(
            "Menu item unavailable.",
          ),
        );

        const result =
          await processSyncOperation(
            {} as never,
            {
              operationId:
                "operation-1",

              operationType:
                "CREATE",

              entityType:
                "ORDER",

              entityId:
                "order-1",

              payload: {},

              restaurantId:
                "restaurant-1",

              userId:
                "user-1",
            },
          );

        expect(
          result,
        ).toEqual({
          status:
            "FAILED",

          response:
            null,

          error:
            "Menu item unavailable.",
        });
      },
    );

    it(
      "rejects unsupported operations",
      async () => {
        const result =
          await processSyncOperation(
            {} as never,
            {
              operationId:
                "operation-1",

              operationType:
                "UPDATE",

              entityType:
                "CATEGORY",

              entityId:
                "order-1",

              payload: {},

              restaurantId:
                "restaurant-1",

              userId:
                "user-1",
            },
          );

        expect(
          result.status,
        ).toBe(
          "FAILED",
        );

        expect(
          result.error,
        ).toBe(
          "Unsupported sync operation: UPDATE CATEGORY.",
        );

        expect(
          processCreateOrder,
        ).not.toHaveBeenCalled();
      },
    );
  },
);