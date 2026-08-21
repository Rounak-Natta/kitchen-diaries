import {
  describe,
  expect,
  it,
} from "vitest";

import {
  getBusinessDate,
} from "./business-date";

function dateKey(
  date: Date,
): string {
  return date
    .toISOString()
    .slice(0, 10);
}

describe(
  "getBusinessDate",
  () => {
    it(
      "assigns 03:59:59 IST to the previous business date",
      () => {
        const instant =
          new Date(
            "2026-07-11T22:29:59.000Z",
          );

        expect(
          dateKey(
            getBusinessDate(
              instant,
            ),
          ),
        ).toBe(
          "2026-07-11",
        );
      },
    );

    it(
      "starts the new business date at 04:00 IST",
      () => {
        const instant =
          new Date(
            "2026-07-11T22:30:00.000Z",
          );

        expect(
          dateKey(
            getBusinessDate(
              instant,
            ),
          ),
        ).toBe(
          "2026-07-12",
        );
      },
    );

    it(
      "keeps a normal evening transaction on the same business date",
      () => {
        const instant =
          new Date(
            "2026-07-12T14:30:00.000Z",
          );

        expect(
          dateKey(
            getBusinessDate(
              instant,
            ),
          ),
        ).toBe(
          "2026-07-12",
        );
      },
    );
  },
);