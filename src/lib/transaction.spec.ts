import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks =
  vi.hoisted(() => ({
    transaction:
      vi.fn(),
  }));

vi.mock(
  "@/lib/prisma",
  () => ({
    prisma: {
      $transaction:
        mocks.transaction,
    },
  }),
);

import {
  withSerializableTransaction,
} from "./transaction";

describe(
  "withSerializableTransaction",
  () => {
    beforeEach(() => {
      mocks.transaction
        .mockReset();
    });

    it(
      "returns the transaction result",
      async () => {
        mocks.transaction
          .mockResolvedValueOnce(
            "completed",
          );

        const result =
          await withSerializableTransaction(
            async () =>
              "ignored by mock",
            {
              baseDelayMs: 0,
            },
          );

        expect(result).toBe(
          "completed",
        );

        expect(
          mocks.transaction,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      "retries Prisma P2034 conflicts",
      async () => {
        const conflict =
          Object.assign(
            new Error(
              "Transaction failed due to a write conflict.",
            ),
            {
              code: "P2034",
            },
          );

        mocks.transaction
          .mockRejectedValueOnce(
            conflict,
          )
          .mockResolvedValueOnce(
            "completed",
          );

        const result =
          await withSerializableTransaction(
            async () =>
              "ignored by mock",
            {
              maxRetries: 2,
              baseDelayMs: 0,
              maxDelayMs: 0,
            },
          );

        expect(result).toBe(
          "completed",
        );

        expect(
          mocks.transaction,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );

    it(
      "does not retry normal application errors",
      async () => {
        mocks.transaction
          .mockRejectedValueOnce(
            new Error(
              "Invalid order.",
            ),
          );

        await expect(
          withSerializableTransaction(
            async () =>
              "ignored by mock",
            {
              maxRetries: 5,
              baseDelayMs: 0,
            },
          ),
        ).rejects.toThrow(
          "Invalid order.",
        );

        expect(
          mocks.transaction,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      "stops after the configured retry limit",
      async () => {
        const conflict =
          Object.assign(
            new Error(
              "Deadlock detected.",
            ),
            {
              code: "P2034",
            },
          );

        mocks.transaction
          .mockRejectedValue(
            conflict,
          );

        await expect(
          withSerializableTransaction(
            async () =>
              "ignored by mock",
            {
              maxRetries: 2,
              baseDelayMs: 0,
              maxDelayMs: 0,
            },
          ),
        ).rejects.toThrow(
          "Deadlock detected.",
        );

        /*
         * Initial attempt plus two retries.
         */
        expect(
          mocks.transaction,
        ).toHaveBeenCalledTimes(
          3,
        );
      },
    );
  },
);