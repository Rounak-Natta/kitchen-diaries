import {
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  WastageDetailDto,
  WastageFormDataDto,
  WastageListItemDto,
} from "../types";

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

  const result =
    Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

export async function getWastageList(
  restaurantId: string,
): Promise<WastageListItemDto[]> {
  const wastages =
    await prisma.wastage.findMany({
      where: {
        restaurantId,
      },

      select: {
        id: true,
        wastageNumber: true,
        status: true,
        businessDate: true,
        totalCost: true,
        createdAt: true,
        postedAt: true,

        createdBy: {
          select: {
            name: true,
          },
        },

        approvedBy: {
          select: {
            name: true,
          },
        },

        _count: {
          select: {
            items: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },

      take: 500,
    });

  return wastages.map(
    (wastage) => ({
      id: wastage.id,

      wastageNumber:
        wastage.wastageNumber,

      status:
        wastage.status,

      businessDate:
        wastage.businessDate
          ?.toISOString()
          .slice(0, 10) ??
        null,

      totalCost:
        decimalToNumber(
          wastage.totalCost,
        ),

      itemCount:
        wastage._count.items,

      createdByName:
        wastage.createdBy.name,

      approvedByName:
        wastage.approvedBy
          ?.name ?? null,

      createdAt:
        wastage.createdAt
          .toISOString(),

      postedAt:
        wastage.postedAt
          ?.toISOString() ??
        null,
    }),
  );
}

export async function getWastageDetail(
  restaurantId: string,
  wastageId: string,
): Promise<WastageDetailDto | null> {
  const wastage =
    await prisma.wastage.findFirst({
      where: {
        id: wastageId,
        restaurantId,
      },

      select: {
        id: true,
        wastageNumber: true,
        status: true,
        businessDate: true,
        totalCost: true,
        notes: true,

        postedAt: true,
        cancelledAt: true,
        cancellationReason: true,
        createdAt: true,

        createdBy: {
          select: {
            name: true,
          },
        },

        approvedBy: {
          select: {
            name: true,
          },
        },

        items: {
          select: {
            id: true,
            quantity: true,
            unit: true,
            unitCost: true,
            totalCost: true,
            reason: true,
            notes: true,

            inventoryItem: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },

            inventoryTransaction: {
              select: {
                transactionNumber:
                  true,
              },
            },
          },

          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

  if (!wastage) {
    return null;
  }

  return {
    id: wastage.id,

    wastageNumber:
      wastage.wastageNumber,

    status:
      wastage.status,

    businessDate:
      wastage.businessDate
        ?.toISOString()
        .slice(0, 10) ??
      null,

    totalCost:
      decimalToNumber(
        wastage.totalCost,
      ),

    notes:
      wastage.notes,

    createdByName:
      wastage.createdBy.name,

    approvedByName:
      wastage.approvedBy
        ?.name ?? null,

    postedAt:
      wastage.postedAt
        ?.toISOString() ??
      null,

    cancelledAt:
      wastage.cancelledAt
        ?.toISOString() ??
      null,

    cancellationReason:
      wastage.cancellationReason,

    createdAt:
      wastage.createdAt
        .toISOString(),

    items:
      wastage.items.map(
        (item) => ({
          id: item.id,

          inventoryItemId:
            item.inventoryItem.id,

          inventoryItemName:
            item.inventoryItem.name,

          inventoryItemCode:
            item.inventoryItem.code,

          quantity:
            decimalToNumber(
              item.quantity,
            ),

          unit:
            item.unit,

          unitCost:
            decimalToNumber(
              item.unitCost,
            ),

          totalCost:
            decimalToNumber(
              item.totalCost,
            ),

          reason:
            item.reason,

          notes:
            item.notes,

          inventoryTransactionNumber:
            item.inventoryTransaction
              ?.transactionNumber ??
            null,
        }),
      ),
  };
}

export async function getWastageFormData(
  restaurantId: string,
  wastageId?: string,
): Promise<WastageFormDataDto | null> {
  const [
    inventoryItems,
    wastage,
  ] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: {
        restaurantId,
        isActive: true,
        deletedAt: null,
      },

      select: {
        id: true,
        name: true,
        code: true,
        unit: true,
        currentStock: true,
        averageCost: true,
      },

      orderBy: {
        name: "asc",
      },
    }),

    wastageId
      ? prisma.wastage.findFirst({
          where: {
            id: wastageId,
            restaurantId,
          },

          select: {
            id: true,
            wastageNumber: true,
            status: true,
            notes: true,

            items: {
              select: {
                id: true,
                inventoryItemId:
                  true,
                quantity: true,
                reason: true,
                notes: true,
              },

              orderBy: {
                createdAt:
                  "asc",
              },
            },
          },
        })
      : null,
  ]);

  if (
    wastageId &&
    !wastage
  ) {
    return null;
  }

  return {
    inventoryItems:
      inventoryItems.map(
        (item) => ({
          id: item.id,
          name: item.name,
          code: item.code,
          unit: item.unit,

          currentStock:
            decimalToNumber(
              item.currentStock,
            ),

          averageCost:
            decimalToNumber(
              item.averageCost,
            ),
        }),
      ),

    wastage: wastage
      ? {
          id: wastage.id,

          wastageNumber:
            wastage.wastageNumber,

          status:
            wastage.status,

          notes:
            wastage.notes,

          items:
            wastage.items.map(
              (item) => ({
                id: item.id,

                inventoryItemId:
                  item.inventoryItemId,

                quantity:
                  decimalToNumber(
                    item.quantity,
                  ),

                reason:
                  item.reason,

                notes:
                  item.notes,
              }),
            ),
        }
      : null,
  };
}