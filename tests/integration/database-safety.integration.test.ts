import {
  DocumentType,
  Prisma,
  Role,
} from "@prisma/client";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  getBusinessDate,
} from "@/lib/business-date";
import {
  nextDocumentNumber,
} from "@/lib/document-number";
import {
  prisma,
} from "@/lib/prisma";
import {
  withSerializableTransaction,
} from "@/lib/transaction";

describe(
  "database safety",
  () => {
    const runId =
      crypto.randomUUID();

    let restaurantAId =
      "";

    let restaurantBId =
      "";

    let ownerAId =
      "";

    const ownerEmail =
      `owner-a-${runId}@example.test`;

    beforeAll(
      async () => {
        const restaurantA =
          await prisma.restaurant.create({
            data: {
              name:
                `Integration Restaurant A ${runId}`,
            },

            select: {
              id: true,
            },
          });

        const restaurantB =
          await prisma.restaurant.create({
            data: {
              name:
                `Integration Restaurant B ${runId}`,
            },

            select: {
              id: true,
            },
          });

        restaurantAId =
          restaurantA.id;

        restaurantBId =
          restaurantB.id;

        const owner =
          await prisma.user.create({
            data: {
              name:
                "Integration Owner",

              email:
                ownerEmail,

              password:
                "integration-test-only",

              role:
                Role.OWNER,

              restaurantId:
                restaurantAId,
            },

            select: {
              id: true,
            },
          });

        ownerAId =
          owner.id;
      },
    );

    afterAll(
      async () => {
        if (
          restaurantAId
        ) {
          await prisma.restaurant.deleteMany({
            where: {
              id:
                restaurantAId,
            },
          });
        }

        if (
          restaurantBId
        ) {
          await prisma.restaurant.deleteMany({
            where: {
              id:
                restaurantBId,
            },
          });
        }
      },
    );

    it(
      "prevents a tenant-scoped query from reading another restaurant's user",
      async () => {
        const result =
          await prisma.user.findFirst({
            where: {
              id:
                ownerAId,

              restaurantId:
                restaurantBId,
            },
          });

        expect(
          result,
        ).toBeNull();
      },
    );

    it(
      "enforces globally unique user emails",
      async () => {
        await expect(
          prisma.user.create({
            data: {
              name:
                "Duplicate User",

              email:
                ownerEmail,

              password:
                "integration-test-only",

              role:
                Role.MANAGER,

              restaurantId:
                restaurantBId,
            },
          }),
        ).rejects.toMatchObject({
          code: "P2002",
        });
      },
    );

    it(
      "rolls back every write when a transaction fails",
      async () => {
        const email =
          `rollback-${runId}@example.test`;

        await expect(
          prisma.$transaction(
            async (
              transaction,
            ) => {
              await transaction.user.create({
                data: {
                  name:
                    "Rollback User",

                  email,

                  password:
                    "integration-test-only",

                  role:
                    Role.CASHIER,

                  restaurantId:
                    restaurantAId,
                },
              });

              throw new Error(
                "Force transaction rollback.",
              );
            },
            {
              isolationLevel:
                Prisma.TransactionIsolationLevel
                  .Serializable,
            },
          ),
        ).rejects.toThrow(
          "Force transaction rollback.",
        );

        const user =
          await prisma.user.findUnique({
            where: {
              email,
            },
          });

        expect(
          user,
        ).toBeNull();
      },
    );

    it(
      "enforces order idempotency at database level",
      async () => {
        const idempotencyKey =
          `integration-order-${runId}`;

        await prisma.order.create({
          data: {
            orderNumber:
              `ORDER-INTEGRATION-${runId}-1`,

            idempotencyKey,

            subtotal:
              new Prisma.Decimal(
                0,
              ),

            tax:
              new Prisma.Decimal(
                0,
              ),

            discount:
              new Prisma.Decimal(
                0,
              ),

            total:
              new Prisma.Decimal(
                0,
              ),

            restaurantId:
              restaurantAId,

            createdById:
              ownerAId,
          },
        });

        await expect(
          prisma.order.create({
            data: {
              orderNumber:
                `ORDER-INTEGRATION-${runId}-2`,

              idempotencyKey,

              subtotal:
                new Prisma.Decimal(
                  0,
                ),

              tax:
                new Prisma.Decimal(
                  0,
                ),

              discount:
                new Prisma.Decimal(
                  0,
                ),

              total:
                new Prisma.Decimal(
                  0,
                ),

              restaurantId:
                restaurantAId,

              createdById:
                ownerAId,
            },
          }),
        ).rejects.toMatchObject({
          code: "P2002",
        });
      },
    );

    it(
      "generates unique sequential document numbers under concurrency",
      async () => {
        const businessDate =
          getBusinessDate(
            new Date(
              "2026-07-12T10:00:00+05:30",
            ),
          );

        const numbers =
          await Promise.all(
            Array.from(
              {
                length: 10,
              },
              () =>
                withSerializableTransaction(
                  (
                    transaction,
                  ) =>
                    nextDocumentNumber(
                      transaction,
                      {
                        restaurantId:
                          restaurantAId,

                        documentType:
                          DocumentType.ORDER,

                        businessDate,
                      },
                    ),
                ),
            ),
          );

        expect(
          new Set(
            numbers,
          ).size,
        ).toBe(10);

        expect(
          numbers.every(
            (number) =>
              /^ORD-20260712-\d{4}$/.test(
                number,
              ),
          ),
        ).toBe(true);

        const suffixes =
          numbers
            .map(
              (number) =>
                Number(
                  number
                    .split("-")
                    .at(-1),
                ),
            )
            .sort(
              (
                first,
                second,
              ) =>
                first -
                second,
            );

        expect(
          suffixes,
        ).toEqual([
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10,
        ]);
      },
    );
  },
);