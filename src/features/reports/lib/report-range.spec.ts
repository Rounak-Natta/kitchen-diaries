import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveReportRange,
} from "./report-range";

describe(
  "report date range",
  () => {
    it(
      "uses the 04:00 Asia/Kolkata business-day boundary",
      () => {
        const range =
          resolveReportRange({
            from:
              "2026-07-01",

            to:
              "2026-07-01",
          });

        expect(
          range.dayCount,
        ).toBe(1);

        expect(
          range.transactionStartUtc.toISOString(),
        ).toBe(
          "2026-06-30T22:30:00.000Z",
        );

        expect(
          range.transactionEndExclusiveUtc.toISOString(),
        ).toBe(
          "2026-07-01T22:30:00.000Z",
        );
      },
    );

    it(
      "supports an inclusive multi-day range",
      () => {
        const range =
          resolveReportRange({
            from:
              "2026-07-01",

            to:
              "2026-07-12",
          });

        expect(
          range.dayCount,
        ).toBe(12);

        expect(
          range.from,
        ).toBe(
          "2026-07-01",
        );

        expect(
          range.to,
        ).toBe(
          "2026-07-12",
        );
      },
    );

    it(
      "replaces ranges longer than 366 days with the default range",
      () => {
        const range =
          resolveReportRange({
            from:
              "2026-01-01",

            to:
              "2027-01-02",
          });

        expect(
          range.dayCount,
        ).toBe(30);

        expect(
          range.warning,
        ).not.toBeNull();
      },
    );
  },
);