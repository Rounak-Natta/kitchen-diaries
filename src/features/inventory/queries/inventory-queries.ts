import {
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  InventoryItemDto,
  InventoryStockStatus,
  InventoryTransactionDto,
} from "../types";

const INVENTORY_ITEM_SELECT = {
  id: true,
  name: true,
  code: true,
  type: true,
  unit: true,

  currentStock: true,
  minimumStock: true,
  reorderLevel: true,
  averageCost: true,

  allowNegativeStock: true,

  category: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.InventoryItemSelect;

type InventoryItemRecord =
  Prisma.InventoryItemGetPayload<{
    select:
      typeof INVENTORY_ITEM_SELECT;
  }>;

function decimalToNumber(
  value:
    | Prisma.Decimal
    | string
    | number
    | null
    | undefined,
): number {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

function getStockStatus(
  currentStock: number,
  minimumStock: number,
  reorderLevel: number,
): InventoryStockStatus {
  if (currentStock <= 0) {
    return "OUT_OF_STOCK";
  }

  const lowStockThreshold =
    Math.max(
      minimumStock,
      reorderLevel,
    );

  if (
    lowStockThreshold > 0 &&
    currentStock <=
      lowStockThreshold
  ) {
    return "LOW_STOCK";
  }

  return "IN_STOCK";
}

function mapInventoryItem(
  item: InventoryItemRecord,
): InventoryItemDto {
  const currentStock =
    decimalToNumber(
      item.currentStock,
    );

  const minimumStock =
    decimalToNumber(
      item.minimumStock,
    );

  const reorderLevel =
    decimalToNumber(
      item.reorderLevel,
    );

  return {
    id: item.id,
    name: item.name,
    code: item.code,
    type: item.type,
    unit: item.unit,

    currentStock,
    minimumStock,
    reorderLevel,

    averageCost:
      decimalToNumber(
        item.averageCost,
      ),

    allowNegativeStock:
      item.allowNegativeStock,

    categoryName:
      item.category?.name ??
      null,

    stockStatus:
      getStockStatus(
        currentStock,
        minimumStock,
        reorderLevel,
      ),
  };
}

export async function getInventoryItems(
  restaurantId: string,
): Promise<InventoryItemDto[]> {
  const items =
    await prisma.inventoryItem.findMany({
      where: {
        restaurantId,
        isActive: true,
        deletedAt: null,
      },

      select:
        INVENTORY_ITEM_SELECT,

      orderBy: [
        {
          category: {
            name: "asc",
          },
        },
        {
          name: "asc",
        },
      ],

      take: 500,
    });

  return items.map(
    mapInventoryItem,
  );
}

export async function getInventoryItem(
  restaurantId: string,
  inventoryItemId: string,
): Promise<InventoryItemDto | null> {
  const item =
    await prisma.inventoryItem.findFirst({
      where: {
        id: inventoryItemId,
        restaurantId,
        isActive: true,
        deletedAt: null,
      },

      select:
        INVENTORY_ITEM_SELECT,
    });

  return item
    ? mapInventoryItem(item)
    : null;
}

export async function getInventoryLedger(
  restaurantId: string,
): Promise<
  InventoryTransactionDto[]
> {
  const transactions =
    await prisma.inventoryTransaction.findMany(
      {
        where: {
          restaurantId,
        },

        select: {
          id: true,
          transactionNumber: true,
          type: true,

          quantityChange: true,
          stockBefore: true,
          stockAfter: true,

          unit: true,
          unitCost: true,
          totalCost: true,

          reason: true,
          referenceType: true,
          referenceId: true,

          businessDate: true,
          createdAt: true,

          inventoryItem: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },

          createdBy: {
            select: {
              name: true,
            },
          },

          order: {
            select: {
              orderNumber: true,
            },
          },

          bill: {
            select: {
              billNumber: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 500,
      },
    );

  return transactions.map(
    (transaction) => ({
      id: transaction.id,

      transactionNumber:
        transaction.transactionNumber,

      type: transaction.type,

      quantityChange:
        decimalToNumber(
          transaction.quantityChange,
        ),

      stockBefore:
        decimalToNumber(
          transaction.stockBefore,
        ),

      stockAfter:
        decimalToNumber(
          transaction.stockAfter,
        ),

      unit: transaction.unit,

      unitCost:
        decimalToNumber(
          transaction.unitCost,
        ),

      totalCost:
        decimalToNumber(
          transaction.totalCost,
        ),

      inventoryItemId:
        transaction.inventoryItem
          .id,

      inventoryItemName:
        transaction.inventoryItem
          .name,

      inventoryItemCode:
        transaction.inventoryItem
          .code,

      reason:
        transaction.reason,

      referenceType:
        transaction.referenceType,

      referenceId:
        transaction.referenceId,

      orderNumber:
        transaction.order
          ?.orderNumber ?? null,

      billNumber:
        transaction.bill
          ?.billNumber ?? null,

      createdByName:
        transaction.createdBy.name,

      businessDate:
        transaction.businessDate
          ?.toISOString()
          .slice(0, 10) ??
        null,

      createdAt:
        transaction.createdAt.toISOString(),
    }),
  );
}