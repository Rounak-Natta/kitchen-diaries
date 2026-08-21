import {
  Prisma,
} from "@prisma/client";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  stringifyExportJson,
} from "./json-export";

describe(
  "export JSON serialization",
  () => {
    it(
      "serializes Decimal and bigint values safely",
      () => {
        const json =
          stringifyExportJson({
            amount:
              new Prisma.Decimal(
                "123.45",
              ),

            sequence:
              BigInt(99),
          });

        const parsed =
          JSON.parse(
            json,
          ) as {
            amount: string;
            sequence: string;
          };

        expect(
          parsed.amount,
        ).toBe(
          "123.45",
        );

        expect(
          parsed.sequence,
        ).toBe(
          "99",
        );
      },
    );

    it(
      "preserves nested arrays and objects",
      () => {
        const json =
          stringifyExportJson({
            items: [
              {
                quantity:
                  new Prisma.Decimal(
                    "1.250",
                  ),
              },
            ],
          });

        const parsed =
          JSON.parse(
            json,
          ) as {
            items: Array<{
              quantity: string;
            }>;
          };

        expect(
          parsed.items[0]
            ?.quantity,
        ).toBe(
          "1.25",
        );
      },
    );
  },
);