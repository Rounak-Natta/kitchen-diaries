"use server";

import {
  DocumentType,
  MenuItemStatus,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit-log";
import { getAuthUser } from "@/lib/api-auth";
import { getBusinessDate } from "@/lib/business-date";
import { nextDocumentNumber } from "@/lib/document-number";
import { prisma } from "@/lib/prisma";
import { createOrderLifecycleNotifications } from "@/features/notifications/lib/notification-service";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";
import {
  withSerializableTransaction,
} from "@/lib/transaction";
import { recordUserBug } from "@/lib/system-event";

import { ORDER_TAX_RATE_PERCENT } from "../constants";
import {
  createOrderSchema,
  type CreateOrderInput,
} from "../validations/create-order-schema";

export type CreateOrderResult =
  | {
      success: true;
      order: {
        id: string;
        orderNumber: string;
      };
    }
  | {
      success: false;
      error: string;
    };

type MoneyValue =
  | string
  | number
  | Prisma.Decimal;

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

  variationOptionId: string | null;
  notes: string | null;

  addons: PreparedAddon[];
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();

  return normalized || null;
}

function toMoney(
  value: MoneyValue,
): Prisma.Decimal {
  const decimal = new Prisma.Decimal(value);

  if (!decimal.isFinite()) {
    throw new Error(
      "Invalid monetary value.",
    );
  }

  return decimal.toDecimalPlaces(2);
}

function toOptionalMoney(
  value:
    | MoneyValue
    | null
    | undefined,
): Prisma.Decimal {
  return toMoney(value ?? 0);
}

function isUniqueConstraintError(
  error: unknown,
): boolean {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function getSafeErrorMessage(
  error: unknown,
): string {
  if (!(error instanceof Error)) {
    return "The order could not be created. Please try again.";
  }

  const safeMessages = [
    "unavailable",
    "selected variation",
    "add-on selected",
    "daily document",
  ];

  const isSafeMessage =
    safeMessages.some((message) =>
      error.message
        .toLowerCase()
        .includes(message),
    );

  return isSafeMessage
    ? error.message
    : "The order could not be created. Please try again.";
}

export async function createOrder(
  data: CreateOrderInput,
): Promise<CreateOrderResult> {
  const user = await getAuthUser();

  if (!user) {
    return {
      success: false,
      error: "Unauthorized.",
    };
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.ORDERS_CREATE,
    )
  ) {
    return {
      success: false,
      error:
        "You do not have permission to create orders.",
    };
  }

  if (!user.restaurantId) {
    return {
      success: false,
      error:
        "No restaurant is assigned to this user.",
    };
  }

  const validation =
    createOrderSchema.safeParse(data);

  if (!validation.success) {
    return {
      success: false,
      error:
        validation.error.issues[0]
          ?.message ??
        "Invalid order information.",
    };
  }

  const input = validation.data;
  const restaurantId =
    user.restaurantId;
  const createdAt = new Date();

  try {
    const order =
      await withSerializableTransaction(
        async (transaction) => {
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
            return existingOrder;
          }

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
            await transaction.menuItem.findMany({
              where: {
                id: {
                  in: requestedMenuItemIds,
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
                            isActive: true,
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
            });

          const menuItemById = new Map(
            menuItems.map((menuItem) => [
              menuItem.id,
              menuItem,
            ]),
          );

          const preparedItems:
            PreparedOrderItem[] = [];

          for (const item of input.items) {
            const menuItem =
              menuItemById.get(
                item.menuItemId,
              );

            if (!menuItem) {
              throw new Error(
                "One or more menu items are unavailable.",
              );
            }

            const availableVariations =
              menuItem.variations.flatMap(
                (variation) =>
                  variation
                    .variationGroup.options,
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
                addonId: addon.id,

                price:
                  toOptionalMoney(
                    addon.price,
                  ),
              });
            }

            const basePrice = toMoney(
              menuItem.price,
            );

            const variationPrice =
              toOptionalMoney(
                selectedVariation?.price,
              );

            const addonPrice =
              selectedAddons
                .reduce(
                  (total, addon) =>
                    total.plus(
                      addon.price,
                    ),
                  toMoney(0),
                )
                .toDecimalPlaces(2);

            const unitPrice = basePrice
              .plus(variationPrice)
              .plus(addonPrice)
              .toDecimalPlaces(2);

            const totalPrice = unitPrice
              .mul(item.quantity)
              .toDecimalPlaces(2);

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

          const subtotal =
            preparedItems
              .reduce(
                (total, item) =>
                  total.plus(
                    item.totalPrice,
                  ),
                toMoney(0),
              )
              .toDecimalPlaces(2);

          const taxRate = toMoney(
            ORDER_TAX_RATE_PERCENT,
          );

          const tax = subtotal
            .mul(taxRate)
            .div(100)
            .toDecimalPlaces(2);

          const discount = toMoney(0);

          const total = subtotal
            .plus(tax)
            .minus(discount)
            .toDecimalPlaces(2);

          const businessDate =
            getBusinessDate(createdAt);

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

          const createdOrder =
            await transaction.order.create({
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
                createdById: user.id,
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
                orderNumber: true,
              },
            });

          await writeAuditLog(
            transaction,
            {
              restaurantId,
              userId: user.id,

              module: "ORDERS",
              action: "CREATE",

              entityType: "Order",
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
                    (sum, item) =>
                      sum +
                      item.quantity,
                    0,
                  ),

                businessDate:
                  businessDate
                    .toISOString()
                    .slice(0, 10),
              },
            },
          );

          await createOrderLifecycleNotifications(transaction, {
            restaurantId,
            orderId: createdOrder.id,
            orderNumber: createdOrder.orderNumber,
            status: "PENDING",
            version: 1,
            actorUserId: user.id,
            eventType: "ORDER_CREATED",
          });

          return createdOrder;
        },
      );

    revalidatePath("/orders");
    revalidatePath("/orders/new");

    return {
      success: true,
      order,
    };
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      const existingOrder =
        await prisma.order.findUnique({
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
          success: true,
          order: existingOrder,
        };
      }
    }

    console.error(
      "CREATE_ORDER_ERROR:",
      error,
    );

    await recordUserBug({
      severity: "ERROR",
      source: "ORDER_CREATE",
      message:
        error instanceof Error
          ? error.message
          : "Unexpected order creation failure.",
      restaurantId,
      metadata: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        idempotencyKey: input.idempotencyKey,
        itemCount: input.items.length,
        orderType: input.orderType,
        action: "CREATE_ORDER",
        path: "/orders/new",
        errorName: error instanceof Error ? error.name : "UnknownError",
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    return {
      success: false,

      error:
        getSafeErrorMessage(error),
    };
  }
}