import {
  BillStatus,
  Prisma,
  WastageStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  resolveReportRange,
  type ReportRangeInput,
} from "../lib/report-range";
import type {
  InventoryReportRowDto,
  PaymentReportRowDto,
  ProfitReportRowDto,
  ReportsDashboardDto,
  SalesReportRowDto,
  WastageReportRowDto,
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

function roundMoney(
  value: number,
): number {
  return Number(
    value.toFixed(2),
  );
}

function roundQuantity(
  value: number,
): number {
  return Number(
    value.toFixed(3),
  );
}

function dateToKey(
  value:
    | Date
    | null,
): string | null {
  return value
    ? value
        .toISOString()
        .slice(0, 10)
    : null;
}

function getInventoryStatus(
  currentStock: number,
  minimumStock: number,
  reorderLevel: number,
): InventoryReportRowDto["status"] {
  if (currentStock <= 0) {
    return "OUT_OF_STOCK";
  }

  if (
    currentStock <=
    Math.max(
      minimumStock,
      reorderLevel,
    )
  ) {
    return "LOW_STOCK";
  }

  return "HEALTHY";
}

export async function getReportsDashboard(
  restaurantId: string,
  input: ReportRangeInput,
  canViewProfit: boolean,
): Promise<ReportsDashboardDto> {
  const range =
    resolveReportRange(
      input,
    );

  const [
    bills,
    payments,
    refunds,
    wastages,
    inventoryItems,
  ] = await Promise.all([
    prisma.bill.findMany({
      where: {
        restaurantId,

        status: {
          not:
            BillStatus.CANCELLED,
        },

        businessDate: {
          gte:
            range.businessFromDate,

          lt:
            range.businessToExclusiveDate,
        },
      },

      select: {
        id: true,

        billNumber: true,
        receiptNumber: true,

        status: true,
        paymentStatus: true,

        businessDate: true,
        createdAt: true,

        customerName: true,

        grandTotal: true,
        amountPaid: true,
        refundedAmount: true,
        dueAmount: true,

        tax: true,
        discount: true,

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

        items: {
          select: {
            id: true,

            itemName: true,
            categoryName: true,

            quantity: true,

            netSales: true,
            costAmount: true,
          },
        },
      },

      orderBy: [
        {
          businessDate: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    }),

    prisma.billPayment.findMany({
      where: {
        bill: {
          restaurantId,
        },

        createdAt: {
          gte:
            range.transactionStartUtc,

          lt:
            range.transactionEndExclusiveUtc,
        },
      },

      select: {
        id: true,
        method: true,
        amount: true,

        referenceNo: true,
        notes: true,
        createdAt: true,

        recordedBy: {
          select: {
            name: true,
          },
        },

        bill: {
          select: {
            billNumber: true,

            order: {
              select: {
                orderNumber: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.billRefund.findMany({
      where: {
        bill: {
          restaurantId,
        },

        createdAt: {
          gte:
            range.transactionStartUtc,

          lt:
            range.transactionEndExclusiveUtc,
        },
      },

      select: {
        id: true,
        refundNumber: true,

        method: true,
        amount: true,

        reason: true,
        referenceNo: true,
        notes: true,
        createdAt: true,

        createdBy: {
          select: {
            name: true,
          },
        },

        bill: {
          select: {
            billNumber: true,

            order: {
              select: {
                orderNumber: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.wastage.findMany({
      where: {
        restaurantId,

        status:
          WastageStatus.POSTED,

        businessDate: {
          gte:
            range.businessFromDate,

          lt:
            range.businessToExclusiveDate,
        },
      },

      select: {
        id: true,
        wastageNumber: true,

        businessDate: true,
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

        items: {
          select: {
            id: true,

            quantity: true,
            unit: true,

            unitCost: true,
            totalCost: true,

            reason: true,

            inventoryItem: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    }),

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
        minimumStock: true,
        reorderLevel: true,
        averageCost: true,

        category: {
          select: {
            name: true,
          },
        },
      },

      orderBy: {
        name: "asc",
      },
    }),
  ]);

  const salesRows:
    SalesReportRowDto[] =
      bills.map((bill) => {
        const grossSales =
          decimalToNumber(
            bill.grandTotal,
          );

        const refundedAmount =
          decimalToNumber(
            bill.refundedAmount,
          );

        return {
          id: bill.id,

          businessDate:
            dateToKey(
              bill.businessDate,
            ),

          billNumber:
            bill.billNumber,

          receiptNumber:
            bill.receiptNumber,

          orderNumber:
            bill.order.orderNumber,

          customerName:
            bill.customerName,

          billStatus:
            bill.status,

          paymentStatus:
            bill.paymentStatus,

          grossSales:
            roundMoney(
              grossSales,
            ),

          refundedAmount:
            roundMoney(
              refundedAmount,
            ),

          netSales:
            roundMoney(
              Math.max(
                0,
                grossSales -
                  refundedAmount,
              ),
            ),

          amountPaid:
            roundMoney(
              decimalToNumber(
                bill.amountPaid,
              ),
            ),

          dueAmount:
            roundMoney(
              decimalToNumber(
                bill.dueAmount,
              ),
            ),

          taxAmount:
            roundMoney(
              decimalToNumber(
                bill.tax,
              ),
            ),

          discountAmount:
            roundMoney(
              decimalToNumber(
                bill.discount,
              ),
            ),

          createdByName:
            bill.createdBy.name,

          createdAt:
            bill.createdAt.toISOString(),
        };
      });

  const paymentRows:
    PaymentReportRowDto[] = [
      ...payments.map(
        (payment) => ({
          id: payment.id,

          direction:
            "PAYMENT" as const,

          documentNumber:
            null,

          billNumber:
            payment.bill
              .billNumber,

          orderNumber:
            payment.bill.order
              .orderNumber,

          method:
            payment.method,

          amount:
            roundMoney(
              decimalToNumber(
                payment.amount,
              ),
            ),

          signedAmount:
            roundMoney(
              decimalToNumber(
                payment.amount,
              ),
            ),

          referenceNo:
            payment.referenceNo,

          description:
            payment.notes,

          recordedByName:
            payment.recordedBy
              ?.name ?? null,

          createdAt:
            payment.createdAt.toISOString(),
        }),
      ),

      ...refunds.map(
        (refund) => ({
          id: refund.id,

          direction:
            "REFUND" as const,

          documentNumber:
            refund.refundNumber,

          billNumber:
            refund.bill
              .billNumber,

          orderNumber:
            refund.bill.order
              .orderNumber,

          method:
            refund.method,

          amount:
            roundMoney(
              decimalToNumber(
                refund.amount,
              ),
            ),

          signedAmount:
            roundMoney(
              -decimalToNumber(
                refund.amount,
              ),
            ),

          referenceNo:
            refund.referenceNo,

          description:
            refund.reason ||
            refund.notes,

          recordedByName:
            refund.createdBy.name,

          createdAt:
            refund.createdAt.toISOString(),
        }),
      ),
    ].sort(
      (first, second) =>
        new Date(
          second.createdAt,
        ).getTime() -
        new Date(
          first.createdAt,
        ).getTime(),
    );

  const inventoryRows:
    InventoryReportRowDto[] =
      inventoryItems.map(
        (item) => {
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

          const averageCost =
            decimalToNumber(
              item.averageCost,
            );

          const stockValue =
            Math.max(
              0,
              currentStock,
            ) * averageCost;

          return {
            id: item.id,

            name: item.name,
            code: item.code,

            categoryName:
              item.category?.name ??
              "Uncategorized",

            unit: item.unit,

            currentStock:
              roundQuantity(
                currentStock,
              ),

            minimumStock:
              roundQuantity(
                minimumStock,
              ),

            reorderLevel:
              roundQuantity(
                reorderLevel,
              ),

            averageCost:
              canViewProfit
                ? roundMoney(
                    averageCost,
                  )
                : null,

            stockValue:
              canViewProfit
                ? roundMoney(
                    stockValue,
                  )
                : null,

            status:
              getInventoryStatus(
                currentStock,
                minimumStock,
                reorderLevel,
              ),
          };
        },
      );

  const wastageRows:
    WastageReportRowDto[] =
      wastages.flatMap(
        (wastage) =>
          wastage.items.map(
            (item) => ({
              id: item.id,

              wastageId:
                wastage.id,

              wastageNumber:
                wastage.wastageNumber,

              businessDate:
                dateToKey(
                  wastage.businessDate,
                ),

              inventoryItemName:
                item.inventoryItem
                  .name,

              inventoryItemCode:
                item.inventoryItem
                  .code,

              reason:
                item.reason,

              quantity:
                roundQuantity(
                  decimalToNumber(
                    item.quantity,
                  ),
                ),

              unit:
                item.unit,

              unitCost:
                canViewProfit
                  ? roundMoney(
                      decimalToNumber(
                        item.unitCost,
                      ),
                    )
                  : null,

              totalCost:
                roundMoney(
                  decimalToNumber(
                    item.totalCost,
                  ),
                ),

              createdByName:
                wastage.createdBy
                  .name,

              approvedByName:
                wastage.approvedBy
                  ?.name ?? null,

              postedAt:
                wastage.postedAt
                  ?.toISOString() ??
                null,
            }),
          ),
      );

  const profitRows:
    ProfitReportRowDto[] =
      canViewProfit
        ? bills.flatMap(
            (bill) => {
              const billRefund =
                decimalToNumber(
                  bill.refundedAmount,
                );

              const itemSales =
                bill.items.map(
                  (item) =>
                    decimalToNumber(
                      item.netSales,
                    ),
                );

              const totalItemSales =
                itemSales.reduce(
                  (
                    sum,
                    value,
                  ) =>
                    sum + value,
                  0,
                );

              let allocatedRefund =
                0;

              return bill.items.map(
                (
                  item,
                  index,
                ) => {
                  const billedNetSales =
                    itemSales[
                      index
                    ] ?? 0;

                  let itemRefund = 0;

                  if (
                    billRefund > 0 &&
                    totalItemSales > 0
                  ) {
                    if (
                      index ===
                      bill.items
                        .length -
                        1
                    ) {
                      itemRefund =
                        billRefund -
                        allocatedRefund;
                    } else {
                      itemRefund =
                        roundMoney(
                          (
                            billedNetSales /
                            totalItemSales
                          ) *
                            billRefund,
                        );

                      allocatedRefund +=
                        itemRefund;
                    }
                  }

                  const adjustedNetSales =
                    Math.max(
                      0,
                      billedNetSales -
                        itemRefund,
                    );

                  const costAmount =
                    decimalToNumber(
                      item.costAmount,
                    );

                  const grossProfit =
                    adjustedNetSales -
                    costAmount;

                  const grossMarginPercent =
                    adjustedNetSales >
                    0
                      ? (
                          grossProfit /
                          adjustedNetSales
                        ) * 100
                      : 0;

                  return {
                    id: item.id,

                    businessDate:
                      dateToKey(
                        bill.businessDate,
                      ),

                    billNumber:
                      bill.billNumber,

                    orderNumber:
                      bill.order
                        .orderNumber,

                    itemName:
                      item.itemName,

                    categoryName:
                      item.categoryName ??
                      "Uncategorized",

                    quantity:
                      item.quantity,

                    billedNetSales:
                      roundMoney(
                        billedNetSales,
                      ),

                    allocatedRefund:
                      roundMoney(
                        itemRefund,
                      ),

                    adjustedNetSales:
                      roundMoney(
                        adjustedNetSales,
                      ),

                    costAmount:
                      roundMoney(
                        costAmount,
                      ),

                    grossProfit:
                      roundMoney(
                        grossProfit,
                      ),

                    grossMarginPercent:
                      roundMoney(
                        grossMarginPercent,
                      ),
                  };
                },
              );
            },
          )
        : [];

  const grossSales =
    salesRows.reduce(
      (sum, row) =>
        sum +
        row.grossSales,
      0,
    );

  const refundedAmount =
    salesRows.reduce(
      (sum, row) =>
        sum +
        row.refundedAmount,
      0,
    );

  const paymentsReceived =
    paymentRows
      .filter(
        (row) =>
          row.direction ===
          "PAYMENT",
      )
      .reduce(
        (sum, row) =>
          sum + row.amount,
        0,
      );

  const transactionRefunds =
    paymentRows
      .filter(
        (row) =>
          row.direction ===
          "REFUND",
      )
      .reduce(
        (sum, row) =>
          sum + row.amount,
        0,
      );

  const outstandingAmount =
    salesRows.reduce(
      (sum, row) =>
        sum +
        row.dueAmount,
      0,
    );

  const costOfGoodsSold =
    profitRows.reduce(
      (sum, row) =>
        sum +
        row.costAmount,
      0,
    );

  const grossProfit =
    profitRows.reduce(
      (sum, row) =>
        sum +
        row.grossProfit,
      0,
    );

  const netSales =
    Math.max(
      0,
      grossSales -
        refundedAmount,
    );

  const inventoryValue =
    inventoryRows.reduce(
      (sum, row) =>
        sum +
        (
          row.stockValue ??
          0
        ),
      0,
    );

  const wastageCost =
    wastageRows.reduce(
      (sum, row) =>
        sum +
        row.totalCost,
      0,
    );

  return {
    range: {
      from: range.from,
      to: range.to,

      dayCount:
        range.dayCount,

      warning:
        range.warning,
    },

    canViewProfit,

    summary: {
      billCount:
        salesRows.length,

      grossSales:
        roundMoney(
          grossSales,
        ),

      refunds:
        roundMoney(
          refundedAmount,
        ),

      netSales:
        roundMoney(
          netSales,
        ),

      paymentsReceived:
        roundMoney(
          paymentsReceived,
        ),

      netCollections:
        roundMoney(
          paymentsReceived -
            transactionRefunds,
        ),

      outstandingAmount:
        roundMoney(
          outstandingAmount,
        ),

      costOfGoodsSold:
        canViewProfit
          ? roundMoney(
              costOfGoodsSold,
            )
          : null,

      grossProfit:
        canViewProfit
          ? roundMoney(
              grossProfit,
            )
          : null,

      grossMarginPercent:
        canViewProfit
          ? roundMoney(
              netSales > 0
                ? (
                    grossProfit /
                    netSales
                  ) * 100
                : 0,
            )
          : null,

      wastageCost:
        roundMoney(
          wastageCost,
        ),

      inventoryValue:
        canViewProfit
          ? roundMoney(
              inventoryValue,
            )
          : null,

      lowStockCount:
        inventoryRows.filter(
          (row) =>
            row.status ===
            "LOW_STOCK",
        ).length,

      outOfStockCount:
        inventoryRows.filter(
          (row) =>
            row.status ===
            "OUT_OF_STOCK",
        ).length,
    },

    salesRows,
    paymentRows,
    inventoryRows,
    wastageRows,
    profitRows,
  };
}