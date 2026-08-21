import {
  InventoryMode,
  InventoryStatus,
  InventoryTransactionType,
  Prisma,
  RecipeAdjustmentType,
  RecipeSource,
} from "@prisma/client";

import {
  writeAuditLog,
} from "@/lib/audit-log";

import {
  convertInventoryQuantity,
} from "./inventory-unit-conversion";
import {
  postInventoryTransaction,
} from "./inventory-transaction-service";

interface PostBillInventoryConsumptionInput {
  restaurantId: string;
  createdById: string;
  billId: string;
  businessDate: Date;
}

export interface BillInventoryConsumptionResult {
  alreadyPosted: boolean;
  transactionCount: number;
  totalCost: Prisma.Decimal;
}

interface ConsumptionEntry {
  inventoryItemId: string;
  inventoryItemName: string;

  unit:
    | "GRAM"
    | "KILOGRAM"
    | "MILLILITRE"
    | "LITRE"
    | "PIECE"
    | "PACKET"
    | "BOX"
    | "BOTTLE"
    | "CAN"
    | "PORTION";

  quantity: Prisma.Decimal;

  sourceTypes:
    Set<RecipeSource>;

  sourceNames:
    Set<string>;
}

function toQuantity(
  value:
    | string
    | number
    | Prisma.Decimal,
): Prisma.Decimal {
  const decimal =
    new Prisma.Decimal(value);

  if (
    !decimal.isFinite() ||
    decimal.lt(0)
  ) {
    throw new Error(
      "Invalid recipe consumption quantity.",
    );
  }

  return decimal.toDecimalPlaces(3);
}

function addConsumption(
  entries: Map<string, ConsumptionEntry>,
  input: {
    inventoryItemId: string;
    inventoryItemName: string;
    inventoryItemUnit:
      ConsumptionEntry["unit"];

    sourceQuantity:
      Prisma.Decimal;

    sourceUnit:
      ConsumptionEntry["unit"];

    sourceType:
      RecipeSource;

    sourceName:
      string;
  },
): void {
  const convertedQuantity =
    convertInventoryQuantity(
      input.sourceQuantity,
      input.sourceUnit,
      input.inventoryItemUnit,
    );

  if (convertedQuantity.lte(0)) {
    return;
  }

  const existing =
    entries.get(
      input.inventoryItemId,
    );

  if (existing) {
    existing.quantity =
      existing.quantity
        .plus(convertedQuantity)
        .toDecimalPlaces(3);

    existing.sourceTypes.add(
      input.sourceType,
    );

    existing.sourceNames.add(
      input.sourceName,
    );

    return;
  }

  entries.set(
    input.inventoryItemId,
    {
      inventoryItemId:
        input.inventoryItemId,

      inventoryItemName:
        input.inventoryItemName,

      unit:
        input.inventoryItemUnit,

      quantity:
        convertedQuantity,

      sourceTypes:
        new Set([
          input.sourceType,
        ]),

      sourceNames:
        new Set([
          input.sourceName,
        ]),
    },
  );
}

function replaceConsumption(
  entries: Map<string, ConsumptionEntry>,
  input: {
    inventoryItemId: string;
    inventoryItemName: string;

    inventoryItemUnit:
      ConsumptionEntry["unit"];

    sourceQuantity:
      Prisma.Decimal;

    sourceUnit:
      ConsumptionEntry["unit"];

    sourceType:
      RecipeSource;

    sourceName:
      string;
  },
): void {
  const convertedQuantity =
    convertInventoryQuantity(
      input.sourceQuantity,
      input.sourceUnit,
      input.inventoryItemUnit,
    );

  if (convertedQuantity.lte(0)) {
    entries.delete(
      input.inventoryItemId,
    );

    return;
  }

  entries.set(
    input.inventoryItemId,
    {
      inventoryItemId:
        input.inventoryItemId,

      inventoryItemName:
        input.inventoryItemName,

      unit:
        input.inventoryItemUnit,

      quantity:
        convertedQuantity,

      sourceTypes:
        new Set([
          input.sourceType,
        ]),

      sourceNames:
        new Set([
          input.sourceName,
        ]),
    },
  );
}

function getPrimarySourceType(
  sourceTypes: Set<RecipeSource>,
): RecipeSource {
  if (sourceTypes.size === 1) {
    return (
      sourceTypes
        .values()
        .next()
        .value ??
      RecipeSource.BASE_RECIPE
    );
  }

  if (
    sourceTypes.has(
      RecipeSource.BASE_RECIPE,
    )
  ) {
    return RecipeSource.BASE_RECIPE;
  }

  if (
    sourceTypes.has(
      RecipeSource.DIRECT,
    )
  ) {
    return RecipeSource.DIRECT;
  }

  if (
    sourceTypes.has(
      RecipeSource.VARIATION,
    )
  ) {
    return RecipeSource.VARIATION;
  }

  return RecipeSource.ADDON;
}

function getSourceName(
  sourceNames: Set<string>,
): string | null {
  const names =
    Array.from(sourceNames);

  return names.length > 0
    ? names.join(", ")
    : null;
}

export async function postBillInventoryConsumption(
  database:
    Prisma.TransactionClient,

  input:
    PostBillInventoryConsumptionInput,
): Promise<BillInventoryConsumptionResult> {
  const restaurantId =
    input.restaurantId.trim();

  const createdById =
    input.createdById.trim();

  const billId =
    input.billId.trim();

  if (!restaurantId) {
    throw new Error(
      "Restaurant ID is required for inventory posting.",
    );
  }

  if (!createdById) {
    throw new Error(
      "Inventory posting user is required.",
    );
  }

  if (!billId) {
    throw new Error(
      "Bill ID is required for inventory posting.",
    );
  }

  const bill =
    await database.bill.findFirst({
      where: {
        id: billId,
        restaurantId,
      },

      select: {
        id: true,
        billNumber: true,
        orderId: true,
        inventoryPostedAt: true,

        items: {
          select: {
            id: true,
            orderItemId: true,
            itemName: true,
            netSales: true,
          },
        },

        order: {
          select: {
            id: true,
            orderNumber: true,

            items: {
              select: {
                id: true,
                quantity: true,

                menuItem: {
                  select: {
                    id: true,
                    name: true,
                    inventoryMode:
                      true,

                    directInventoryItem:
                      {
                        select: {
                          id: true,
                          name: true,
                          unit: true,
                          isActive: true,
                          deletedAt: true,
                        },
                      },

                    recipe: {
                      select: {
                        id: true,
                        name: true,
                        isActive: true,
                        deletedAt: true,

                        items: {
                          select: {
                            id: true,
                            quantity: true,
                            unit: true,
                            wastagePercent:
                              true,

                            inventoryItem:
                              {
                                select: {
                                  id: true,
                                  name: true,
                                  unit: true,
                                  isActive:
                                    true,
                                  deletedAt:
                                    true,
                                },
                              },
                          },

                          orderBy: {
                            sortOrder:
                              "asc",
                          },
                        },
                      },
                    },
                  },
                },

                variationOption: {
                  select: {
                    id: true,
                    name: true,

                    recipeAdjustments:
                      {
                        select: {
                          id: true,
                          adjustmentType:
                            true,
                          quantity: true,
                          unit: true,

                          inventoryItem:
                            {
                              select: {
                                id: true,
                                name: true,
                                unit: true,
                                isActive:
                                  true,
                                deletedAt:
                                  true,
                              },
                            },
                        },
                      },
                  },
                },

                addons: {
                  select: {
                    addon: {
                      select: {
                        id: true,
                        name: true,

                        recipeItems: {
                          select: {
                            id: true,
                            quantity: true,
                            unit: true,

                            inventoryItem:
                              {
                                select: {
                                  id: true,
                                  name: true,
                                  unit: true,
                                  isActive:
                                    true,
                                  deletedAt:
                                    true,
                                },
                              },
                          },
                        },
                      },
                    },
                  },
                },
              },

              orderBy: {
                createdAt: "asc",
              },
            },
          },
        },
      },
    });

  if (!bill) {
    throw new Error(
      "Bill was not found for inventory posting.",
    );
  }

  if (bill.inventoryPostedAt) {
    return {
      alreadyPosted: true,
      transactionCount: 0,
      totalCost:
        new Prisma.Decimal(0),
    };
  }

  const billItemByOrderItemId =
    new Map(
      bill.items
        .filter(
          (
            billItem,
          ): billItem is typeof billItem & {
            orderItemId: string;
          } =>
            billItem.orderItemId !==
            null,
        )
        .map((billItem) => [
          billItem.orderItemId,
          billItem,
        ]),
    );

  let transactionCount = 0;

  let totalInventoryCost =
    new Prisma.Decimal(0);

  for (
    const orderItem of
    bill.order.items
  ) {
    const billItem =
      billItemByOrderItemId.get(
        orderItem.id,
      );

    if (!billItem) {
      throw new Error(
        `Bill item was not found for order item ${orderItem.id}.`,
      );
    }

    const entries =
      new Map<
        string,
        ConsumptionEntry
      >();

    const itemQuantity =
      toQuantity(
        orderItem.quantity,
      );

    const menuItem =
      orderItem.menuItem;

    if (
      menuItem.inventoryMode ===
      InventoryMode.DIRECT
    ) {
      const directItem =
        menuItem.directInventoryItem;

      if (
        !directItem ||
        !directItem.isActive ||
        directItem.deletedAt
      ) {
        throw new Error(
          `Direct inventory item is not configured correctly for ${menuItem.name}.`,
        );
      }

      addConsumption(entries, {
        inventoryItemId:
          directItem.id,

        inventoryItemName:
          directItem.name,

        inventoryItemUnit:
          directItem.unit,

        sourceQuantity:
          itemQuantity,

        sourceUnit:
          directItem.unit,

        sourceType:
          RecipeSource.DIRECT,

        sourceName:
          menuItem.name,
      });
    }

    if (
      menuItem.inventoryMode ===
      InventoryMode.RECIPE
    ) {
      const recipe =
        menuItem.recipe;

      if (
        !recipe ||
        !recipe.isActive ||
        recipe.deletedAt
      ) {
        throw new Error(
          `An active recipe is required for ${menuItem.name}.`,
        );
      }

      if (
        recipe.items.length === 0
      ) {
        throw new Error(
          `The active recipe for ${menuItem.name} has no ingredients.`,
        );
      }

      for (
        const recipeItem of
        recipe.items
      ) {
        const inventoryItem =
          recipeItem.inventoryItem;

        if (
          !inventoryItem.isActive ||
          inventoryItem.deletedAt
        ) {
          throw new Error(
            `Inventory item ${inventoryItem.name} is inactive.`,
          );
        }

        const wastageMultiplier =
          new Prisma.Decimal(1).plus(
            recipeItem.wastagePercent
              .div(100),
          );

        const consumption =
          recipeItem.quantity
            .mul(wastageMultiplier)
            .mul(itemQuantity)
            .toDecimalPlaces(3);

        addConsumption(entries, {
          inventoryItemId:
            inventoryItem.id,

          inventoryItemName:
            inventoryItem.name,

          inventoryItemUnit:
            inventoryItem.unit,

          sourceQuantity:
            consumption,

          sourceUnit:
            recipeItem.unit,

          sourceType:
            RecipeSource.BASE_RECIPE,

          sourceName:
            recipe.name,
        });
      }
    }

    const variation =
      orderItem.variationOption;

    if (variation) {
      for (
        const adjustment of
        variation.recipeAdjustments
      ) {
        const inventoryItem =
          adjustment.inventoryItem;

        if (
          !inventoryItem.isActive ||
          inventoryItem.deletedAt
        ) {
          throw new Error(
            `Inventory item ${inventoryItem.name} is inactive.`,
          );
        }

        const consumption =
          adjustment.quantity
            .mul(itemQuantity)
            .toDecimalPlaces(3);

        if (
          adjustment.adjustmentType ===
          RecipeAdjustmentType.REMOVE
        ) {
          entries.delete(
            inventoryItem.id,
          );

          continue;
        }

        if (
          adjustment.adjustmentType ===
          RecipeAdjustmentType.REPLACE
        ) {
          replaceConsumption(
            entries,
            {
              inventoryItemId:
                inventoryItem.id,

              inventoryItemName:
                inventoryItem.name,

              inventoryItemUnit:
                inventoryItem.unit,

              sourceQuantity:
                consumption,

              sourceUnit:
                adjustment.unit,

              sourceType:
                RecipeSource.VARIATION,

              sourceName:
                `Variation: ${variation.name}`,
            },
          );

          continue;
        }

        addConsumption(entries, {
          inventoryItemId:
            inventoryItem.id,

          inventoryItemName:
            inventoryItem.name,

          inventoryItemUnit:
            inventoryItem.unit,

          sourceQuantity:
            consumption,

          sourceUnit:
            adjustment.unit,

          sourceType:
            RecipeSource.VARIATION,

          sourceName:
            `Variation: ${variation.name}`,
        });
      }
    }

    for (
      const orderItemAddon of
      orderItem.addons
    ) {
      const addon =
        orderItemAddon.addon;

      for (
        const addonRecipeItem of
        addon.recipeItems
      ) {
        const inventoryItem =
          addonRecipeItem.inventoryItem;

        if (
          !inventoryItem.isActive ||
          inventoryItem.deletedAt
        ) {
          throw new Error(
            `Inventory item ${inventoryItem.name} is inactive.`,
          );
        }

        const consumption =
          addonRecipeItem.quantity
            .mul(itemQuantity)
            .toDecimalPlaces(3);

        addConsumption(entries, {
          inventoryItemId:
            inventoryItem.id,

          inventoryItemName:
            inventoryItem.name,

          inventoryItemUnit:
            inventoryItem.unit,

          sourceQuantity:
            consumption,

          sourceUnit:
            addonRecipeItem.unit,

          sourceType:
            RecipeSource.ADDON,

          sourceName:
            `Addon: ${addon.name}`,
        });
      }
    }

    let billItemCost =
      new Prisma.Decimal(0);

    for (
      const entry of
      entries.values()
    ) {
      if (entry.quantity.lte(0)) {
        continue;
      }

      const inventoryTransaction =
        await postInventoryTransaction(
          database,
          {
            restaurantId,
            createdById,

            inventoryItemId:
              entry.inventoryItemId,

            type:
              InventoryTransactionType.SALE_CONSUMPTION,

            quantityChange:
              entry.quantity.negated(),

            idempotencyKey:
              `bill:${bill.id}:item:${billItem.id}:inventory:${entry.inventoryItemId}`,

            reason:
              `Sale consumption for ${billItem.itemName}`,

            referenceType:
              "BILL",

            referenceId:
              bill.id,

            businessDate:
              input.businessDate,

            orderId:
              bill.orderId,

            billId:
              bill.id,

            billItemId:
              billItem.id,
          },
        );

      await database.billItemIngredient.create({
        data: {
          billItemId:
            billItem.id,

          inventoryItemId:
            entry.inventoryItemId,

          inventoryTransactionId:
            inventoryTransaction.id,

          sourceType:
            getPrimarySourceType(
              entry.sourceTypes,
            ),

          sourceName:
            getSourceName(
              entry.sourceNames,
            ),

          inventoryItemName:
            entry.inventoryItemName,

          quantity:
            entry.quantity,

          unit:
            entry.unit,

          unitCost:
            inventoryTransaction.unitCost,

          totalCost:
            inventoryTransaction.totalCost,
        },
      });

      billItemCost =
        billItemCost
          .plus(
            inventoryTransaction.totalCost,
          )
          .toDecimalPlaces(2);

      totalInventoryCost =
        totalInventoryCost
          .plus(
            inventoryTransaction.totalCost,
          )
          .toDecimalPlaces(2);

      transactionCount += 1;
    }

    const grossProfit =
      billItem.netSales
        .minus(billItemCost)
        .toDecimalPlaces(2);

    const grossMarginPct =
      billItem.netSales.gt(0)
        ? grossProfit
            .mul(100)
            .div(
              billItem.netSales,
            )
            .toDecimalPlaces(2)
        : new Prisma.Decimal(0);

    await database.billItem.update({
      where: {
        id: billItem.id,
      },

      data: {
        costAmount:
          billItemCost,

        grossProfit,

        grossMarginPct,
      },
    });
  }

  const postedAt =
    new Date();

  await database.bill.update({
    where: {
      id: bill.id,
    },

    data: {
      inventoryPostedAt:
        postedAt,
    },
  });

  await database.order.update({
    where: {
      id: bill.orderId,
    },

    data: {
      inventoryStatus:
        InventoryStatus.DEDUCTED,

      inventoryDeductedAt:
        postedAt,
    },
  });

  await writeAuditLog(
    database,
    {
      restaurantId,
      userId:
        createdById,

      module: "INVENTORY",

      action:
        "POST_BILL_CONSUMPTION",

      entityType: "Bill",
      entityId:
        bill.id,

      newData: {
        billNumber:
          bill.billNumber,

        orderId:
          bill.orderId,

        orderNumber:
          bill.order.orderNumber,

        transactionCount,

        totalInventoryCost:
          totalInventoryCost.toString(),

        inventoryStatus:
          InventoryStatus.DEDUCTED,

        postedAt:
          postedAt.toISOString(),
      },
    },
  );

  return {
    alreadyPosted: false,
    transactionCount,

    totalCost:
      totalInventoryCost,
  };
}