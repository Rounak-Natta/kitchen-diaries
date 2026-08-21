import {
  DocumentType,
  MenuItemStatus,
  Prisma,
} from "@prisma/client";

import {
  getBusinessDate,
} from "@/lib/business-date";

import {
  nextDocumentNumber,
} from "@/lib/document-number";

import {
  writeAuditLog,
} from "@/lib/audit-log";

import {
  ORDER_TAX_RATE_PERCENT,
} from "@/features/orders/constants";
import { createOrderLifecycleNotifications } from "@/features/notifications/lib/notification-service";

import {
  createOrderSchema,
  type CreateOrderInput,
} from "@/features/orders/validations/create-order-schema";

// ======================================================
// TYPES
// ======================================================

export interface ProcessCreateOrderContext {
  userId: string;
  restaurantId: string;
}

export interface ProcessCreateOrderResult {
  orderId: string;
  orderNumber: string;
}

// ======================================================
// MONEY
// ======================================================

type MoneyValue =
  | string
  | number
  | Prisma.Decimal;

function toMoney(
  value: MoneyValue,
): Prisma.Decimal {
  const decimal =
    new Prisma.Decimal(
      value,
    );

  if (!decimal.isFinite()) {
    throw new Error(
      "Invalid monetary value.",
    );
  }

  return decimal.toDecimalPlaces(
    2,
  );
}

function toOptionalMoney(
  value:
    | MoneyValue
    | null
    | undefined,
): Prisma.Decimal {
  return toMoney(
    value ?? 0,
  );
}

// ======================================================
// TEXT
// ======================================================

function normalizeOptionalText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    value?.trim();

  return normalized || null;
}

// ======================================================
// PREPARED TYPES
// ======================================================

interface PreparedAddon {
  addonId: string;
  price: Prisma.Decimal;
}

interface PreparedOrderItem {
  menuItemId: string;
  itemName: string;
  quantity: number;

  basePrice: Prisma.Decimal;
  variationPrice: Prisma.Decimal;
  addonPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;

  variationOptionId:
    | string
    | null;

  notes: string | null;

  addons: PreparedAddon[];
}

// ======================================================
// PROCESS CREATE ORDER
// ======================================================

export async function processCreateOrder(
  transaction: Prisma.TransactionClient,
  payload: unknown,
  context: ProcessCreateOrderContext,
): Promise<ProcessCreateOrderResult> {
  // ----------------------------------------------------
  // VALIDATE PAYLOAD
  // ----------------------------------------------------

  const rawPayload =
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload)
      ? { ...(payload as Record<string, unknown>) }
      : null;

  const offlineCreatedAt =
    typeof rawPayload?._createdAt === "string"
      ? new Date(rawPayload._createdAt)
      : new Date();

  if (Number.isNaN(offlineCreatedAt.getTime())) {
    throw new Error("Invalid offline order timestamp.");
  }

  const offlineBusinessDate =
    typeof rawPayload?._businessDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(rawPayload._businessDate)
      ? new Date(`${rawPayload._businessDate}T00:00:00.000Z`)
      : getBusinessDate(offlineCreatedAt);
  if (Number.isNaN(offlineBusinessDate.getTime())) throw new Error("Invalid offline order business date.");

  if (rawPayload) {
    delete rawPayload._createdAt;
    delete rawPayload._businessDate;
    // Backward compatibility for orders queued by older PWA builds.
    // This local-only field is not part of the strict server order contract.
    delete rawPayload._localOrderId;
  }

  const validation =
    createOrderSchema.safeParse(
      rawPayload ?? payload,
    );

  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]
        ?.message ??
        "Invalid order information.",
    );
  }

  const input:
    CreateOrderInput =
    validation.data;

  // ----------------------------------------------------
  // RESTAURANT
  // ----------------------------------------------------

  const restaurantId =
    context.restaurantId;

  const createdAt =
    offlineCreatedAt;

  // ----------------------------------------------------
  // IDEMPOTENCY
  //
  // The same order must never be created twice.
  // ----------------------------------------------------

  const existingOrder =
    await transaction.order.findUnique({
      where: {
        restaurantId_idempotencyKey:
          {
            restaurantId,

            idempotencyKey:
              input.idempotencyKey,
          },
      },

      select: {
        id: true,
        orderNumber: true,
      },
    });

  if (existingOrder) {
    return {
      orderId:
        existingOrder.id,

      orderNumber:
        existingOrder.orderNumber,
    };
  }

  // ----------------------------------------------------
  // LOAD MENU ITEMS
  // ----------------------------------------------------

  const requestedMenuItemIds =
    Array.from(
      new Set(
        input.items.map(
          (item) =>
            item.menuItemId,
        ),
      ),
    );

  const menuItems =
    await transaction.menuItem.findMany(
      {
        where: {
          id: {
            in:
              requestedMenuItemIds,
          },

          restaurantId,

          isActive: true,

          status:
            MenuItemStatus.AVAILABLE,
        },

        select: {
          id: true,
          name: true,
          price: true,

          variations: {
            select: {
              variationGroup: {
                select: {
                  options: {
                    where: {
                      isActive:
                        true,
                    },

                    select: {
                      id: true,
                      price: true,
                    },
                  },
                },
              },
            },
          },

          addons: {
            where: {
              addon: {
                isActive: true,
              },
            },

            select: {
              addon: {
                select: {
                  id: true,
                  price: true,
                },
              },
            },
          },
        },
      },
    );

  // ----------------------------------------------------
  // INDEX MENU ITEMS
  // ----------------------------------------------------

  const menuItemById =
    new Map(
      menuItems.map(
        (menuItem) => [
          menuItem.id,
          menuItem,
        ],
      ),
    );

  // ----------------------------------------------------
  // PREPARE ORDER ITEMS
  // ----------------------------------------------------

  const preparedItems:
    PreparedOrderItem[] = [];

  for (
    const item of input.items
  ) {
    const menuItem =
      menuItemById.get(
        item.menuItemId,
      );

    if (!menuItem) {
      throw new Error(
        "One or more menu items are unavailable.",
      );
    }

    // ----------------------------------------------
    // VARIATIONS
    // ----------------------------------------------

    const availableVariations =
      menuItem.variations.flatMap(
        (variation) =>
          variation
            .variationGroup
            .options,
      );

    const selectedVariation =
      item.variationOptionId
        ? availableVariations.find(
            (variation) =>
              variation.id ===
              item.variationOptionId,
          )
        : undefined;

    if (
      item.variationOptionId &&
      !selectedVariation
    ) {
      throw new Error(
        `The selected variation is not available for ${menuItem.name}.`,
      );
    }

    // ----------------------------------------------
    // ADDONS
    // ----------------------------------------------

    const availableAddonById =
      new Map(
        menuItem.addons.map(
          (link) => [
            link.addon.id,
            link.addon,
          ],
        ),
      );

    const selectedAddons:
      PreparedAddon[] = [];

    for (
      const addonId of
        item.addonIds
    ) {
      const addon =
        availableAddonById.get(
          addonId,
        );

      if (!addon) {
        throw new Error(
          `An add-on selected for ${menuItem.name} is unavailable.`,
        );
      }

      selectedAddons.push({
        addonId:
          addon.id,

        price:
          toOptionalMoney(
            addon.price,
          ),
      });
    }

    // ----------------------------------------------
    // PRICES
    // ----------------------------------------------

    const basePrice =
      toMoney(
        menuItem.price,
      );

    const variationPrice =
      toOptionalMoney(
        selectedVariation?.price,
      );

    const addonPrice =
      selectedAddons
        .reduce(
          (
            total,
            addon,
          ) =>
            total.plus(
              addon.price,
            ),
          toMoney(0),
        )
        .toDecimalPlaces(
          2,
        );

    const unitPrice =
      basePrice
        .plus(
          variationPrice,
        )
        .plus(
          addonPrice,
        )
        .toDecimalPlaces(
          2,
        );

    const totalPrice =
      unitPrice
        .mul(
          item.quantity,
        )
        .toDecimalPlaces(
          2,
        );

    preparedItems.push({
      menuItemId:
        menuItem.id,

      itemName:
        menuItem.name,

      quantity:
        item.quantity,

      basePrice,

      variationPrice,

      addonPrice,

      totalPrice,

      variationOptionId:
        selectedVariation?.id ??
        null,

      notes:
        normalizeOptionalText(
          item.notes,
        ),

      addons:
        selectedAddons,
    });
  }

  // ----------------------------------------------------
  // TOTALS
  // ----------------------------------------------------

  const subtotal =
    preparedItems
      .reduce(
        (
          total,
          item,
        ) =>
          total.plus(
            item.totalPrice,
          ),
        toMoney(0),
      )
      .toDecimalPlaces(
        2,
      );

  const taxRate =
    toMoney(
      ORDER_TAX_RATE_PERCENT,
    );

  const tax =
    subtotal
      .mul(
        taxRate,
      )
      .div(100)
      .toDecimalPlaces(
        2,
      );

  const discount =
    toMoney(0);

  const total =
    subtotal
      .plus(tax)
      .minus(discount)
      .toDecimalPlaces(
        2,
      );

  // ----------------------------------------------------
  // BUSINESS DATE
  // ----------------------------------------------------

  const businessDate =
    offlineBusinessDate;

  // ----------------------------------------------------
  // DOCUMENT NUMBER
  // ----------------------------------------------------

  const orderNumber =
    await nextDocumentNumber(
      transaction,
      {
        restaurantId,

        documentType:
          DocumentType.ORDER,

        businessDate,
      },
    );

  // ----------------------------------------------------
  // CREATE ORDER
  // ----------------------------------------------------

  const createdOrder =
    await transaction.order.create(
      {
        data: {
          orderNumber,

          idempotencyKey:
            input.idempotencyKey,

          orderType:
            input.orderType,

          tableNumber:
            normalizeOptionalText(
              input.tableNumber,
            ),

          notes:
            normalizeOptionalText(
              input.notes,
            ),

          subtotal,

          taxRate,

          tax,

          discount,

          total,

          businessDate,

          restaurantId,

          createdById:
            context.userId,

          createdAt,

          items: {
            create:
              preparedItems.map(
                (item) => ({
                  menuItemId:
                    item.menuItemId,

                  itemName:
                    item.itemName,

                  quantity:
                    item.quantity,

                  basePrice:
                    item.basePrice,

                  variationPrice:
                    item.variationPrice,

                  addonPrice:
                    item.addonPrice,

                  totalPrice:
                    item.totalPrice,

                  variationOptionId:
                    item.variationOptionId,

                  notes:
                    item.notes,

                  addons:
                    item.addons
                      .length > 0
                      ? {
                          create:
                            item.addons.map(
                              (
                                addon,
                              ) => ({
                                addonId:
                                  addon.addonId,

                                price:
                                  addon.price,
                              }),
                            ),
                        }
                      : undefined,
                }),
              ),
          },
        },

        select: {
          id: true,

          orderNumber:
            true,
        },
      },
    );

  // ----------------------------------------------------
  // AUDIT LOG
  // ----------------------------------------------------

  await writeAuditLog(
    transaction,
    {
      restaurantId,

      userId:
        context.userId,

      module:
        "ORDERS",

      action:
        "CREATE",

      entityType:
        "Order",

      entityId:
        createdOrder.id,

      newData: {
        orderNumber:
          createdOrder.orderNumber,

        orderType:
          input.orderType,

        tableNumber:
          normalizeOptionalText(
            input.tableNumber,
          ),

        subtotal:
          subtotal.toString(),

        taxRate:
          taxRate.toString(),

        tax:
          tax.toString(),

        discount:
          discount.toString(),

        total:
          total.toString(),

        itemCount:
          preparedItems.length,

        totalQuantity:
          preparedItems.reduce(
            (
              sum,
              item,
            ) =>
              sum +
              item.quantity,
            0,
          ),

        businessDate:
          businessDate
            .toISOString()
            .slice(
              0,
              10,
            ),
      },
    },
  );

  await createOrderLifecycleNotifications(transaction, {
    restaurantId,
    orderId: createdOrder.id,
    orderNumber: createdOrder.orderNumber,
    status: "PENDING",
    version: 1,
    actorUserId: context.userId,
    eventType: "ORDER_CREATED",
  });

  return {
    orderId:
      createdOrder.id,

    orderNumber:
      createdOrder.orderNumber,
  };
}