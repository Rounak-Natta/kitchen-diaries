import {
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  InventoryItemFormDataDto,
} from "../types";

function decimalToNumber(
  value:
    | Prisma.Decimal
    | number
    | string
    | null
    | undefined,
): number {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const result =
    Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

export async function getInventoryItemFormData(
  restaurantId: string,
  inventoryItemId?: string,
): Promise<InventoryItemFormDataDto | null> {
  const [categories, item] =
    await Promise.all([
      prisma.inventoryCategory.findMany({
        where: {
          restaurantId,
          isActive: true,
          deletedAt: null,
        },

        select: {
          id: true,
          name: true,
        },

        orderBy: {
          name: "asc",
        },
      }),

      inventoryItemId
        ? prisma.inventoryItem.findFirst({
            where: {
              id:
                inventoryItemId,

              restaurantId,
              isActive: true,
              deletedAt: null,
            },

            select: {
              id: true,
              name: true,
              code: true,
              barcode: true,
              description: true,
              type: true,
              unit: true,
              minimumStock: true,
              reorderLevel: true,
              currentStock: true,
              averageCost: true,
              allowNegativeStock:
                true,
              notes: true,
              categoryId: true,
            },
          })
        : null,
    ]);

  if (
    inventoryItemId &&
    !item
  ) {
    return null;
  }

  return {
    categories,

    item: item
      ? {
          id: item.id,
          name: item.name,
          code: item.code,
          barcode:
            item.barcode,
          description:
            item.description,
          type: item.type,
          unit: item.unit,

          minimumStock:
            decimalToNumber(
              item.minimumStock,
            ),

          reorderLevel:
            decimalToNumber(
              item.reorderLevel,
            ),

          currentStock:
            decimalToNumber(
              item.currentStock,
            ),

          averageCost:
            decimalToNumber(
              item.averageCost,
            ),

          allowNegativeStock:
            item.allowNegativeStock,

          notes: item.notes,

          categoryId:
            item.categoryId,
        }
      : null,
  };
}