import {
  BillStatus,
  InventoryStatus,
  OrderStatus,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  OrderLifecycleDto,
  OrderLifecycleStatus,
  OrderReconciliationIssueDto,
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

  const converted =
    Number(value);

  return Number.isFinite(
    converted,
  )
    ? converted
    : 0;
}

export async function getOrderLifecycle(
  restaurantId: string,
  orderId: string,
): Promise<OrderLifecycleDto | null> {
  const order =
    await prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId,
      },

      select: {
        id: true,
        orderNumber: true,

        status: true,
        inventoryStatus: true,
        version: true,

        orderType: true,
        tableNumber: true,

        customerName: true,
        customerPhone: true,

        total: true,

        confirmedAt: true,
        preparingAt: true,
        readyAt: true,
        billedAt: true,
        completedAt: true,
        cancelledAt: true,
        cancellationReason: true,

        createdAt: true,
        updatedAt: true,

        createdBy: {
          select: {
            name: true,
          },
        },

        cancelledBy: {
          select: {
            name: true,
          },
        },

        bill: {
          select: {
            id: true,
            billNumber: true,
            status: true,
            paymentStatus: true,
            dueAmount: true,
          },
        },

        _count: {
          select: {
            items: true,
          },
        },
      },
    });

  if (!order) {
    return null;
  }

  return {
    id: order.id,

    orderNumber:
      order.orderNumber,

    status:
      order.status,

    inventoryStatus:
      order.inventoryStatus,

    version:
      order.version,

    orderType:
      order.orderType,

    tableNumber:
      order.tableNumber,

    customerName:
      order.customerName,

    customerPhone:
      order.customerPhone,

    total:
      decimalToNumber(
        order.total,
      ),

    itemCount:
      order._count.items,

    createdByName:
      order.createdBy.name,

    cancelledByName:
      order.cancelledBy
        ?.name ?? null,

    confirmedAt:
      order.confirmedAt
        ?.toISOString() ??
      null,

    preparingAt:
      order.preparingAt
        ?.toISOString() ??
      null,

    readyAt:
      order.readyAt
        ?.toISOString() ??
      null,

    billedAt:
      order.billedAt
        ?.toISOString() ??
      null,

    completedAt:
      order.completedAt
        ?.toISOString() ??
      null,

    cancelledAt:
      order.cancelledAt
        ?.toISOString() ??
      null,

    cancellationReason:
      order.cancellationReason,

    createdAt:
      order.createdAt.toISOString(),

    updatedAt:
      order.updatedAt.toISOString(),

    bill:
      order.bill
        ? {
            id:
              order.bill.id,

            billNumber:
              order.bill
                .billNumber,

            status:
              order.bill.status,

            paymentStatus:
              order.bill
                .paymentStatus,

            dueAmount:
              decimalToNumber(
                order.bill
                  .dueAmount,
              ),
          }
        : null,
  };
}

export async function getOrderReconciliationIssues(
  restaurantId: string,
): Promise<
  OrderReconciliationIssueDto[]
> {
  const orders =
    await prisma.order.findMany({
      where: {
        restaurantId,
      },

      select: {
        id: true,
        orderNumber: true,

        status: true,
        inventoryStatus: true,
        version: true,

        updatedAt: true,

        bill: {
          select: {
            id: true,
            billNumber: true,

            status: true,
            paymentStatus: true,

            dueAmount: true,
            inventoryPostedAt: true,
          },
        },
      },

      orderBy: {
        updatedAt: "desc",
      },

      take: 500,
    });

  const issues:
    OrderReconciliationIssueDto[] =
    [];

  function addIssue(
    order:
      (typeof orders)[number],

    input: {
      code:
        OrderReconciliationIssueDto["code"];

      severity:
        OrderReconciliationIssueDto["severity"];

      message: string;
      repairable: boolean;
    },
  ): void {
    issues.push({
      id:
        `${order.id}:${input.code}`,

      orderId:
        order.id,

      orderNumber:
        order.orderNumber,

      code:
        input.code,

      severity:
        input.severity,

      message:
        input.message,

      repairable:
        input.repairable,

      orderStatus:
        order.status,

      inventoryStatus:
        order.inventoryStatus,

      version:
        order.version,

      billId:
        order.bill?.id ??
        null,

      billNumber:
        order.bill
          ?.billNumber ??
        null,

      billStatus:
        order.bill?.status ??
        null,

      paymentStatus:
        order.bill
          ?.paymentStatus ??
        null,

      updatedAt:
        order.updatedAt.toISOString(),
    });
  }

  for (const order of orders) {
    const bill =
      order.bill;

    if (!bill) {
      if (
        order.status ===
        OrderStatus.BILLED
      ) {
        addIssue(order, {
          code:
            "BILLED_WITHOUT_BILL",

          severity: "HIGH",

          message:
            "The order is marked as billed but no bill exists.",

          repairable: false,
        });
      }

      if (
        order.status ===
        OrderStatus.COMPLETED
      ) {
        addIssue(order, {
          code:
            "COMPLETED_WITHOUT_BILL",

          severity: "HIGH",

          message:
            "The order is completed but no bill exists.",

          repairable: false,
        });
      }

      if (
        order.inventoryStatus !==
        InventoryStatus.NOT_DEDUCTED
      ) {
        addIssue(order, {
          code:
            "INVENTORY_WITHOUT_BILL",

          severity: "HIGH",

          message:
            "Inventory status indicates processing, but the order has no bill.",

          repairable: false,
        });
      }

      continue;
    }

    if (
      order.status ===
        OrderStatus.CANCELLED &&
      bill.status !==
        BillStatus.CANCELLED
    ) {
      addIssue(order, {
        code:
          "ORDER_CANCELLED_WITH_ACTIVE_BILL",

        severity: "HIGH",

        message:
          "The order is cancelled while its bill is still active or refunded.",

        repairable: false,
      });

      continue;
    }

    if (
      bill.status ===
        BillStatus.CANCELLED &&
      order.status !==
        OrderStatus.CANCELLED
    ) {
      addIssue(order, {
        code:
          "CANCELLED_BILL_ORDER_NOT_CANCELLED",

        severity: "HIGH",

        message:
          "The bill is cancelled but the order is not cancelled.",

        repairable: false,
      });

      continue;
    }

    if (
      bill.status !==
        BillStatus.CANCELLED &&
      order.status !==
        OrderStatus.CANCELLED
    ) {
      const expectedStatus =
        bill.dueAmount.lte(0)
          ? OrderStatus.COMPLETED
          : OrderStatus.BILLED;

      if (
        order.status !==
        expectedStatus
      ) {
        addIssue(order, {
          code:
            "ORDER_STATUS_MISMATCH",

          severity:
            "MEDIUM",

          message:
            `Bill state requires the order status to be ${expectedStatus}.`,

          repairable: true,
        });
      }
    }

    if (
      bill.inventoryPostedAt &&
      order.inventoryStatus ===
        InventoryStatus.NOT_DEDUCTED
    ) {
      addIssue(order, {
        code:
          "INVENTORY_POSTING_MISMATCH",

        severity:
          "MEDIUM",

        message:
          "The bill has inventory transactions, but the order is marked as not deducted.",

        repairable:
          bill.status !==
          BillStatus.CANCELLED,
      });
    }

    if (
      !bill.inventoryPostedAt &&
      order.inventoryStatus ===
        InventoryStatus.DEDUCTED
    ) {
      addIssue(order, {
        code:
          "INVENTORY_POSTING_MISMATCH",

        severity: "HIGH",

        message:
          "The order is marked as deducted, but the bill has no inventory posting timestamp.",

        repairable: false,
      });
    }
  }

  const severityOrder = {
    HIGH: 0,
    MEDIUM: 1,
  } as const;

  return issues.sort(
    (first, second) => {
      const severityDifference =
        severityOrder[
          first.severity
        ] -
        severityOrder[
          second.severity
        ];

      if (
        severityDifference !== 0
      ) {
        return severityDifference;
      }

      return (
        new Date(
          second.updatedAt,
        ).getTime() -
        new Date(
          first.updatedAt,
        ).getTime()
      );
    },
  );
}