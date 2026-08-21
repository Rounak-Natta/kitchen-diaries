import {
  describe,
  expect,
  it,
} from "vitest";

import {
  canCancelOrderStatus,
  getAllowedManualOrderTransitions,
} from "./order-state-machine";

describe(
  "order state machine",
  () => {
    it(
      "allows pending orders to become confirmed",
      () => {
        expect(
          getAllowedManualOrderTransitions(
            "PENDING",
          ),
        ).toEqual([
          "CONFIRMED",
        ]);
      },
    );

    it(
      "allows confirmed orders to begin preparation",
      () => {
        expect(
          getAllowedManualOrderTransitions(
            "CONFIRMED",
          ),
        ).toEqual([
          "PREPARING",
        ]);
      },
    );

    it(
      "allows preparing orders to become ready",
      () => {
        expect(
          getAllowedManualOrderTransitions(
            "PREPARING",
          ),
        ).toEqual([
          "READY",
        ]);
      },
    );

    it(
      "does not allow manual transitions after ready",
      () => {
        expect(
          getAllowedManualOrderTransitions(
            "READY",
          ),
        ).toEqual([]);

        expect(
          getAllowedManualOrderTransitions(
            "BILLED",
          ),
        ).toEqual([]);

        expect(
          getAllowedManualOrderTransitions(
            "COMPLETED",
          ),
        ).toEqual([]);
      },
    );

    it(
      "allows only pre-billing statuses to be cancelled",
      () => {
        expect(
          canCancelOrderStatus(
            "PENDING",
          ),
        ).toBe(true);

        expect(
          canCancelOrderStatus(
            "READY",
          ),
        ).toBe(true);

        expect(
          canCancelOrderStatus(
            "BILLED",
          ),
        ).toBe(false);

        expect(
          canCancelOrderStatus(
            "COMPLETED",
          ),
        ).toBe(false);

        expect(
          canCancelOrderStatus(
            "CANCELLED",
          ),
        ).toBe(false);
      },
    );
  },
);