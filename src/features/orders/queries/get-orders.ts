import { prisma } from "@/lib/prisma";

import type {
  OrderItemDetailsDto,
  OrderListItemDto,
} from "../types";

export async function getOrdersForList(
  restaurantId: string,
): Promise<OrderListItemDto[]> {
  const orders =
    await prisma.order.findMany({
      where: {
        restaurantId,
      },

      select: {
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
        total: true,
        createdAt: true,

        createdBy: {
          select: {
            name: true,
          },
        },

        bill: {
          select: {
            id: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },

      take: 100,
    });

  if (orders.length === 0) {
    return [];
  }

  const itemCounts =
    await prisma.orderItem.groupBy({
      by: ["orderId"],

      where: {
        orderId: {
          in: orders.map(
            (order) => order.id,
          ),
        },
      },

      _sum: {
        quantity: true,
      },
    });

  const countByOrderId = new Map(
    itemCounts.map((result) => [
      result.orderId,
      result._sum.quantity ?? 0,
    ]),
  );

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    status: order.status,
    total: Number(order.total),

    createdAt:
      order.createdAt.toISOString(),

    createdByName:
      order.createdBy.name,

    totalItems:
      countByOrderId.get(order.id) ??
      0,

    billId: order.bill?.id ?? null,
  }));
}

export async function getOrderItemsForDisplay(
  restaurantId: string,
  orderId: string,
): Promise<OrderItemDetailsDto[] | null> {
  const order =
    await prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId,
      },

      select: {
        id: true,
      },
    });

  if (!order) {
    return null;
  }

  const items =
    await prisma.orderItem.findMany({
      where: {
        orderId,
      },

      select: {
        id: true,
        itemName: true,
        quantity: true,
        totalPrice: true,
        notes: true,

        variationOption: {
          select: {
            name: true,
          },
        },

        addons: {
          select: {
            id: true,

            addon: {
              select: {
                name: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "asc",
      },
    });

  return items.map((item) => ({
    id: item.id,
    itemName: item.itemName,
    quantity: item.quantity,
    totalPrice: Number(
      item.totalPrice,
    ),
    notes: item.notes,

    variationName:
      item.variationOption?.name ??
      null,

    addons: item.addons.map(
      (addon) => ({
        id: addon.id,
        name: addon.addon.name,
      }),
    ),
  }));
}