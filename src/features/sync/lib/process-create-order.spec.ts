import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  Prisma,
} from "@prisma/client";

import {
  processCreateOrder,
} from "./process-create-order";

// ======================================================
// TEST IDS
// ======================================================

const USER_ID =
  "11111111-1111-4111-8111-111111111111";

const RESTAURANT_ID =
  "22222222-2222-4222-8222-222222222222";

const MENU_ITEM_ID =
  "33333333-3333-4333-8333-333333333333";

const VARIATION_ID =
  "44444444-4444-4444-8444-444444444444";

const ADDON_ID =
  "55555555-5555-4555-8555-555555555555";

const ORDER_ID =
  "66666666-6666-4666-8666-666666666666";

const EXISTING_ORDER_ID =
  "77777777-7777-4777-8777-777777777777";

const DIFFERENT_VARIATION_ID =
  "88888888-8888-4888-8888-888888888888";

const IDEMPOTENCY_KEY =
  "99999999-9999-4999-8999-999999999999";

// ======================================================
// MOCKS
// ======================================================

vi.mock(
  "@/lib/document-number",
  () => ({
    nextDocumentNumber:
      vi.fn(),
  }),
);

vi.mock(
  "@/lib/audit-log",
  () => ({
    writeAuditLog:
      vi.fn(),
  }),
);

vi.mock(
  "@/lib/business-date",
  () => ({
    getBusinessDate:
      vi.fn(),
  }),
);

// ======================================================
// MOCK IMPORTS
// ======================================================

import {
  nextDocumentNumber,
} from "@/lib/document-number";

import {
  writeAuditLog,
} from "@/lib/audit-log";

import {
  getBusinessDate,
} from "@/lib/business-date";

// ======================================================
// HELPERS
// ======================================================

function createTransactionMock() {
  return {
    order: {
      findUnique:
        vi.fn(),

      create:
        vi.fn(),
    },

    menuItem: {
      findMany:
        vi.fn(),
    },

    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },

    notification: {
      createMany: vi.fn(),
    },
  };
}

function createValidPayload() {
  return {
    // Regression coverage: older PWA builds queued this local-only field.
    // The sync processor must discard it before strict create-order validation.
    _localOrderId:
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",

    _createdAt:
      "2026-08-13T10:30:00.000Z",

    _businessDate:
      "2026-08-13",

    idempotencyKey:
      IDEMPOTENCY_KEY,

    orderType:
      "DINE_IN",

    tableNumber:
      "T1",

    items: [
      {
        menuItemId:
          MENU_ITEM_ID,

        quantity:
          2,

        variationOptionId:
          VARIATION_ID,

        addonIds: [
          ADDON_ID,
        ],
      },
    ],
  };
}

// ======================================================
// TESTS
// ======================================================

describe(
  "process create order",
  () => {
    beforeEach(
      () => {
        vi.clearAllMocks();

        vi.mocked(
          getBusinessDate,
        ).mockReturnValue(
          new Date(
            "2026-08-13T00:00:00.000Z",
          ),
        );

        vi.mocked(
          nextDocumentNumber,
        ).mockResolvedValue(
          "ORD-20260813-0001",
        );

        vi.mocked(
          writeAuditLog,
        ).mockResolvedValue(
          undefined,
        );
      },
    );

    // ==================================================
    // CREATE ORDER
    // ==================================================

    it(
      "creates an order with items and addons",
      async () => {
        const transaction =
          createTransactionMock();

        transaction.order.findUnique
          .mockResolvedValue(
            null,
          );

        transaction.menuItem.findMany
          .mockResolvedValue([
            {
              id:
                MENU_ITEM_ID,

              name:
                "Chicken Biryani",

              price:
                new Prisma.Decimal(
                  "200.00",
                ),

              variations: [
                {
                  variationGroup: {
                    options: [
                      {
                        id:
                          VARIATION_ID,

                        price:
                          new Prisma.Decimal(
                            "30.00",
                          ),

                        isActive:
                          true,
                      },
                    ],
                  },
                },
              ],

              addons: [
                {
                  addon: {
                    id:
                      ADDON_ID,

                    price:
                      new Prisma.Decimal(
                        "20.00",
                      ),

                    isActive:
                      true,
                  },
                },
              ],
            },
          ]);

        transaction.order.create
          .mockResolvedValue({
            id:
              ORDER_ID,

            orderNumber:
              "ORD-20260813-0001",
          });

        const result =
          await processCreateOrder(
            transaction as never,

            createValidPayload(),

            {
              userId:
                USER_ID,

              restaurantId:
                RESTAURANT_ID,
            },
          );

        expect(
          result,
        ).toEqual({
          orderId:
            ORDER_ID,

          orderNumber:
            "ORD-20260813-0001",
        });

        expect(
          nextDocumentNumber,
        ).toHaveBeenCalledWith(
          transaction,
          {
            restaurantId:
              RESTAURANT_ID,

            documentType:
              "ORDER",

            businessDate:
              new Date(
                "2026-08-13T00:00:00.000Z",
              ),
          },
        );

        expect(
          transaction.order.create,
        ).toHaveBeenCalledTimes(
          1,
        );

        const createCall =
          transaction.order.create
            .mock.calls[0][0];

        expect(
          createCall.data,
        ).toMatchObject({
          orderNumber:
            "ORD-20260813-0001",

          idempotencyKey:
            IDEMPOTENCY_KEY,

          orderType:
            "DINE_IN",

          tableNumber:
            "T1",

          restaurantId:
            RESTAURANT_ID,

          createdById:
            USER_ID,

          subtotal:
            new Prisma.Decimal(
              "500.00",
            ),

          total:
            expect.any(
              Prisma.Decimal,
            ),
        });

        expect(
          createCall.data.items.create,
        ).toHaveLength(
          1,
        );

        expect(
          createCall.data.items.create[0],
        ).toMatchObject({
          menuItemId:
            MENU_ITEM_ID,

          itemName:
            "Chicken Biryani",

          quantity:
            2,

          basePrice:
            new Prisma.Decimal(
              "200.00",
            ),

          variationPrice:
            new Prisma.Decimal(
              "30.00",
            ),

          addonPrice:
            new Prisma.Decimal(
              "20.00",
            ),

          totalPrice:
            new Prisma.Decimal(
              "500.00",
            ),

          variationOptionId:
            VARIATION_ID,
        });

        expect(
          createCall.data.items.create[0]
            .addons.create,
        ).toEqual([
          {
            addonId:
              ADDON_ID,

            price:
              new Prisma.Decimal(
                "20.00",
              ),
          },
        ]);

        expect(
          writeAuditLog,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    // ==================================================
    // IDEMPOTENCY
    // ==================================================

    it(
      "returns the existing order for the same idempotency key",
      async () => {
        const transaction =
          createTransactionMock();

        transaction.order.findUnique
          .mockResolvedValue({
            id:
              EXISTING_ORDER_ID,

            orderNumber:
              "ORD-20260813-0001",
          });

        const result =
          await processCreateOrder(
            transaction as never,

            createValidPayload(),

            {
              userId:
                USER_ID,

              restaurantId:
                RESTAURANT_ID,
            },
          );

        expect(
          result,
        ).toEqual({
          orderId:
            EXISTING_ORDER_ID,

          orderNumber:
            "ORD-20260813-0001",
        });

        expect(
          transaction.menuItem.findMany,
        ).not.toHaveBeenCalled();

        expect(
          transaction.order.create,
        ).not.toHaveBeenCalled();

        expect(
          nextDocumentNumber,
        ).not.toHaveBeenCalled();

        expect(
          writeAuditLog,
        ).not.toHaveBeenCalled();
      },
    );

    // ==================================================
    // INVALID MENU ITEM
    // ==================================================

    it(
      "rejects an unavailable menu item",
      async () => {
        const transaction =
          createTransactionMock();

        transaction.order.findUnique
          .mockResolvedValue(
            null,
          );

        transaction.menuItem.findMany
          .mockResolvedValue(
            [],
          );

        await expect(
          processCreateOrder(
            transaction as never,

            createValidPayload(),

            {
              userId:
                USER_ID,

              restaurantId:
                RESTAURANT_ID,
            },
          ),
        ).rejects.toThrow(
          "One or more menu items are unavailable.",
        );

        expect(
          transaction.order.create,
        ).not.toHaveBeenCalled();

        expect(
          nextDocumentNumber,
        ).not.toHaveBeenCalled();
      },
    );

    // ==================================================
    // INVALID VARIATION
    // ==================================================

    it(
      "rejects an unavailable variation",
      async () => {
        const transaction =
          createTransactionMock();

        transaction.order.findUnique
          .mockResolvedValue(
            null,
          );

        transaction.menuItem.findMany
          .mockResolvedValue([
            {
              id:
                MENU_ITEM_ID,

              name:
                "Chicken Biryani",

              price:
                new Prisma.Decimal(
                  "200.00",
                ),

              variations: [
                {
                  variationGroup: {
                    options: [
                      {
                        id:
                          DIFFERENT_VARIATION_ID,

                        price:
                          new Prisma.Decimal(
                            "30.00",
                          ),

                        isActive:
                          true,
                      },
                    ],
                  },
                },
              ],

              addons: [],
            },
          ]);

        await expect(
          processCreateOrder(
            transaction as never,

            createValidPayload(),

            {
              userId:
                USER_ID,

              restaurantId:
                RESTAURANT_ID,
            },
          ),
        ).rejects.toThrow(
          "The selected variation is not available for Chicken Biryani.",
        );

        expect(
          transaction.order.create,
        ).not.toHaveBeenCalled();

        expect(
          nextDocumentNumber,
        ).not.toHaveBeenCalled();
      },
    );

    // ==================================================
    // INVALID ADDON
    // ==================================================

    it(
  "rejects an unavailable addon",
  async () => {
    const transaction =
      createTransactionMock();

    transaction.order.findUnique
      .mockResolvedValue(
        null,
      );

    transaction.menuItem.findMany
      .mockResolvedValue([
        {
          id:
            MENU_ITEM_ID,

          name:
            "Chicken Biryani",

          price:
            new Prisma.Decimal(
              "200.00",
            ),

          // IMPORTANT:
          // The requested variation must be
          // available so execution reaches
          // addon validation.
          variations: [
            {
              variationGroup: {
                options: [
                  {
                    id:
                      VARIATION_ID,

                    price:
                      new Prisma.Decimal(
                        "30.00",
                      ),

                    isActive:
                      true,
                  },
                ],
              },
            },
          ],

          // Requested ADDON_ID is intentionally
          // missing from the available addons.
          addons: [],
        },
      ]);

    await expect(
      processCreateOrder(
        transaction as never,

        createValidPayload(),

        {
          userId:
            USER_ID,

          restaurantId:
            RESTAURANT_ID,
        },
      ),
    ).rejects.toThrow(
      "An add-on selected for Chicken Biryani is unavailable.",
    );

    expect(
      transaction.order.create,
    ).not.toHaveBeenCalled();

    expect(
      nextDocumentNumber,
    ).not.toHaveBeenCalled();
  },
);
  },
);