import {
  OrderStatus,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  BillDetailsDto,
  BillingHistoryItemDto,
  BillingOrderDto,
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

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}


export async function resolveBillingOrderId(
  restaurantId: string,
  requestedOrderId: string,
): Promise<string> {
  const directOrder = await prisma.order.findFirst({
    where: {
      id: requestedOrderId,
      restaurantId,
    },
    select: { id: true },
  });

  if (directOrder) return directOrder.id;

  const createOperation = await prisma.syncOperation.findFirst({
    where: {
      restaurantId,
      entityType: "ORDER",
      entityId: requestedOrderId,
      operationType: "CREATE",
      status: "COMPLETED",
    },
    orderBy: [
      { completedAt: "desc" },
      { createdAt: "desc" },
    ],
    select: { responsePayload: true },
  });

  const response =
    createOperation?.responsePayload &&
    typeof createOperation.responsePayload === "object" &&
    !Array.isArray(createOperation.responsePayload)
      ? (createOperation.responsePayload as Record<string, unknown>)
      : null;

  const resolvedOrderId =
    typeof response?.orderId === "string" ? response.orderId : null;

  if (!resolvedOrderId) return requestedOrderId;

  const resolvedOrder = await prisma.order.findFirst({
    where: {
      id: resolvedOrderId,
      restaurantId,
    },
    select: { id: true },
  });

  return resolvedOrder?.id ?? requestedOrderId;
}

export async function getOrderForBilling(
  restaurantId: string,
  orderId: string,
): Promise<BillingOrderDto | null> {
  const order =
    await prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId,

        status: {
          notIn: [
            OrderStatus.CANCELLED,
            OrderStatus.COMPLETED,
          ],
        },
      },

      select: {
        id: true,
        orderNumber: true,
        orderType: true,
        tableNumber: true,

        customerName: true,
        customerPhone: true,
        customerAddress: true,

        subtotal: true,
        taxRate: true,
        tax: true,
        discount: true,
        serviceCharge: true,
        deliveryCharge: true,
        packagingCharge: true,
        total: true,

        createdAt: true,

        items: {
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
                price: true,

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

    orderType:
      order.orderType,

    tableNumber:
      order.tableNumber,

    customerName:
      order.customerName,

    customerPhone:
      order.customerPhone,

    customerAddress:
      order.customerAddress,

    subtotal:
      decimalToNumber(
        order.subtotal,
      ),

    taxRate:
      decimalToNumber(
        order.taxRate,
      ),

    tax:
      decimalToNumber(
        order.tax,
      ),

    discount:
      decimalToNumber(
        order.discount,
      ),

    serviceCharge:
      decimalToNumber(
        order.serviceCharge,
      ),

    deliveryCharge:
      decimalToNumber(
        order.deliveryCharge,
      ),

    packagingCharge:
      decimalToNumber(
        order.packagingCharge,
      ),

    total:
      decimalToNumber(
        order.total,
      ),

    createdAt:
      order.createdAt.toISOString(),

    items:
      order.items.map(
        (item) => ({
          id: item.id,

          itemName:
            item.itemName,

          quantity:
            item.quantity,

          totalPrice:
            decimalToNumber(
              item.totalPrice,
            ),

          notes:
            item.notes,

          variationName:
            item.variationOption
              ?.name ?? null,

          addons:
            item.addons.map(
              (entry) => ({
                id: entry.id,

                name:
                  entry.addon.name,

                price:
                  decimalToNumber(
                    entry.price,
                  ),
              }),
            ),
        }),
      ),
  };
}

export async function getBillDetails(
  restaurantId: string,
  billId: string,
): Promise<BillDetailsDto | null> {
  const bill =
    await prisma.bill.findFirst({
      where: {
        id: billId,
        restaurantId,
      },

      select: {
        id: true,
        billNumber: true,
        receiptNumber: true,
        status: true,

        orderId: true,
        orderType: true,
        tableNumber: true,

        customerName: true,
        customerPhone: true,
        customerAddress: true,

        subtotal: true,
        taxRate: true,
        tax: true,
        discount: true,
        serviceCharge: true,
        deliveryCharge: true,
        packagingCharge: true,
        roundOff: true,

        grandTotal: true,
        amountPaid: true,
        refundedAmount: true,
        changeReturned: true,
        dueAmount: true,
        paymentStatus: true,

        businessDate: true,
        paidAt: true,
        notes: true,
        createdAt: true,

        restaurant: {
          select: {
            name: true,
            address: true,
            phone: true,
            email: true,
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
            status: true,
          },
        },

        items: {
          select: {
            id: true,
            itemName: true,
            categoryName: true,
            quantity: true,

            unitPrice: true,
            addonPrice: true,
            variationPrice: true,

            grossAmount: true,
            discountAmount: true,
            taxAmount: true,
            netSales: true,
            totalPrice: true,

            notes: true,
            variationName: true,
            addonNames: true,
          },

          orderBy: {
            createdAt: "asc",
          },
        },

        payments: {
          select: {
            id: true,
            method: true,
            amount: true,
            tenderedAmount: true,
            referenceNo: true,
            notes: true,
            createdAt: true,

            recordedBy: {
              select: {
                name: true,
              },
            },
          },

          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

  if (!bill) {
    return null;
  }

  return {
    id: bill.id,

    billNumber:
      bill.billNumber,

    receiptNumber:
      bill.receiptNumber,

    status:
      bill.status,

    orderId:
      bill.orderId,

    orderNumber:
      bill.order.orderNumber,

    orderStatus:
      bill.order.status,

    orderType:
      bill.orderType,

    tableNumber:
      bill.tableNumber,

    customerName:
      bill.customerName,

    customerPhone:
      bill.customerPhone,

    customerAddress:
      bill.customerAddress,

    subtotal:
      decimalToNumber(
        bill.subtotal,
      ),

    taxRate:
      decimalToNumber(
        bill.taxRate,
      ),

    tax:
      decimalToNumber(
        bill.tax,
      ),

    discount:
      decimalToNumber(
        bill.discount,
      ),

    serviceCharge:
      decimalToNumber(
        bill.serviceCharge,
      ),

    deliveryCharge:
      decimalToNumber(
        bill.deliveryCharge,
      ),

    packagingCharge:
      decimalToNumber(
        bill.packagingCharge,
      ),

    roundOff:
      decimalToNumber(
        bill.roundOff,
      ),

    grandTotal:
      decimalToNumber(
        bill.grandTotal,
      ),

    amountPaid:
      decimalToNumber(
        bill.amountPaid,
      ),

    refundedAmount:
      decimalToNumber(
        bill.refundedAmount,
      ),

    changeReturned:
      decimalToNumber(
        bill.changeReturned,
      ),

    dueAmount:
      decimalToNumber(
        bill.dueAmount,
      ),

    paymentStatus:
      bill.paymentStatus,

    businessDate:
      bill.businessDate
        ?.toISOString()
        .slice(0, 10) ??
      null,

    paidAt:
      bill.paidAt
        ?.toISOString() ??
      null,

    notes:
      bill.notes,

    createdAt:
      bill.createdAt.toISOString(),

    restaurant:
      bill.restaurant,

    createdByName:
      bill.createdBy.name,

    items:
      bill.items.map(
        (item) => ({
          id: item.id,

          itemName:
            item.itemName,

          categoryName:
            item.categoryName,

          quantity:
            item.quantity,

          unitPrice:
            decimalToNumber(
              item.unitPrice,
            ),

          addonPrice:
            decimalToNumber(
              item.addonPrice,
            ),

          variationPrice:
            decimalToNumber(
              item.variationPrice,
            ),

          grossAmount:
            decimalToNumber(
              item.grossAmount,
            ),

          discountAmount:
            decimalToNumber(
              item.discountAmount,
            ),

          taxAmount:
            decimalToNumber(
              item.taxAmount,
            ),

          netSales:
            decimalToNumber(
              item.netSales,
            ),

          totalPrice:
            decimalToNumber(
              item.totalPrice,
            ),

          notes:
            item.notes,

          variationName:
            item.variationName,

          addonNames:
            item.addonNames,
        }),
      ),

    payments:
      bill.payments.map(
        (payment) => ({
          id: payment.id,

          method:
            payment.method,

          amount:
            decimalToNumber(
              payment.amount,
            ),

          tenderedAmount:
            payment.tenderedAmount ===
            null
              ? null
              : decimalToNumber(
                  payment.tenderedAmount,
                ),

          referenceNo:
            payment.referenceNo,

          notes:
            payment.notes,

          recordedByName:
            payment.recordedBy
              ?.name ?? null,

          createdAt:
            payment.createdAt.toISOString(),
        }),
      ),
  };
}

export async function getBillingHistory(
  restaurantId: string,
): Promise<
  BillingHistoryItemDto[]
> {
  const bills =
    await prisma.bill.findMany({
      where: {
        restaurantId,
      },

      select: {
        id: true,
        billNumber: true,
        receiptNumber: true,
        status: true,

        grandTotal: true,
        amountPaid: true,
        dueAmount: true,
        paymentStatus: true,

        customerName: true,
        createdAt: true,

        order: {
          select: {
            orderNumber: true,
          },
        },

        createdBy: {
          select: {
            name: true,
          },
        },

        payments: {
          select: {
            method: true,
          },

          orderBy: {
            createdAt: "asc",
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },

      take: 100,
    });

  return bills.map(
    (bill) => ({
      id: bill.id,

      billNumber:
        bill.billNumber,

      receiptNumber:
        bill.receiptNumber,

      orderNumber:
        bill.order.orderNumber,

      customerName:
        bill.customerName,

      createdByName:
        bill.createdBy.name,

      grandTotal:
        decimalToNumber(
          bill.grandTotal,
        ),

      amountPaid:
        decimalToNumber(
          bill.amountPaid,
        ),

      dueAmount:
        decimalToNumber(
          bill.dueAmount,
        ),

      paymentStatus:
        bill.paymentStatus,

      status:
        bill.status,

      createdAt:
        bill.createdAt.toISOString(),

      paymentMethods:
        Array.from(
          new Set(
            bill.payments.map(
              (payment) =>
                payment.method,
            ),
          ),
        ),
    }),
  );
}

export async function getExistingBillIdForOrder(
  restaurantId: string,
  orderId: string,
): Promise<string | null> {
  const bill =
    await prisma.bill.findFirst({
      where: {
        restaurantId,
        orderId,
      },

      select: {
        id: true,
      },
    });

  return bill?.id ?? null;
}