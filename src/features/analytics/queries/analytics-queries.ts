import {
  BillStatus,
  Prisma,
  WastageStatus,
} from "@prisma/client";

import {
  getBusinessDate,
} from "@/lib/business-date";
import { prisma } from "@/lib/prisma";

import type {
  AnalyticsDashboardDto,
  AnalyticsDateRangeDto,
  DailySalesAnalyticsDto,
  LowStockAnalyticsDto,
  PaymentMethodAnalyticsDto,
  TopSellingItemDto,
  WastageReasonAnalyticsDto,
} from "../types";

interface AnalyticsDateRangeInput {
  from?: string;
  to?: string;
}

interface ResolvedAnalyticsRange
  extends AnalyticsDateRangeDto {
  fromDate: Date;
  toExclusive: Date;
}

interface MutableDailySales {
  businessDate: string;
  billCount: number;
  grossSales: number;
  refunds: number;
  netSales: number;
  costOfGoodsSold: number;
  grossProfit: number;
}

interface MutableTopItem {
  key: string;
  itemName: string;
  categoryName: string;
  quantity: number;
  billedNetSales: number;
  costAmount: number;
  grossProfit: number;
}

interface MutablePaymentMethod {
  method: string;
  transactionCount: number;
  amount: number;
}

interface MutableWastageReason {
  reason: string;
  itemCount: number;
  quantity: number;
  totalCost: number;
}

const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/;

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
  date: Date,
): string {
  return date
    .toISOString()
    .slice(0, 10);
}

function addUtcDays(
  date: Date,
  days: number,
): Date {
  const result =
    new Date(date);

  result.setUTCDate(
    result.getUTCDate() +
      days,
  );

  return result;
}

function parseDateKey(
  value:
    | string
    | undefined,
): Date | null {
  if (
    !value ||
    !DATE_PATTERN.test(value)
  ) {
    return null;
  }

  const date =
    new Date(
      `${value}T00:00:00.000Z`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    ) ||
    dateToKey(date) !== value
  ) {
    return null;
  }

  return date;
}

function getInclusiveDayCount(
  from: Date,
  to: Date,
): number {
  const difference =
    to.getTime() -
    from.getTime();

  return (
    Math.floor(
      difference /
        86_400_000,
    ) + 1
  );
}

function getDefaultRange(): {
  fromDate: Date;
  toDate: Date;
} {
  const currentBusinessDate =
    getBusinessDate(
      new Date(),
    );

  const toDate =
    new Date(
      `${dateToKey(
        currentBusinessDate,
      )}T00:00:00.000Z`,
    );

  return {
    fromDate:
      addUtcDays(
        toDate,
        -29,
      ),

    toDate,
  };
}

function resolveAnalyticsRange(
  input:
    AnalyticsDateRangeInput,
): ResolvedAnalyticsRange {
  const defaultRange =
    getDefaultRange();

  let fromDate =
    parseDateKey(
      input.from,
    );

  let toDate =
    parseDateKey(
      input.to,
    );

  let warning:
    string | null = null;

  if (!fromDate) {
    fromDate =
      defaultRange.fromDate;

    if (input.from) {
      warning =
        "The selected start date was invalid. The default range was used.";
    }
  }

  if (!toDate) {
    toDate =
      defaultRange.toDate;

    if (input.to) {
      warning =
        "The selected end date was invalid. The default range was used.";
    }
  }

  let dayCount =
    getInclusiveDayCount(
      fromDate,
      toDate,
    );

  if (
    dayCount <= 0 ||
    dayCount > 366
  ) {
    fromDate =
      defaultRange.fromDate;

    toDate =
      defaultRange.toDate;

    dayCount =
      getInclusiveDayCount(
        fromDate,
        toDate,
      );

    warning =
      "Analytics supports a maximum range of 366 days. The default 30-day range was used.";
  }

  return {
    from:
      dateToKey(fromDate),

    to:
      dateToKey(toDate),

    dayCount,

    warning,

    fromDate,

    toExclusive:
      addUtcDays(
        toDate,
        1,
      ),
  };
}

export async function getAnalyticsDashboard(
  restaurantId: string,
  input:
    AnalyticsDateRangeInput,
  canViewProfit: boolean,
): Promise<AnalyticsDashboardDto> {
  const range =
    resolveAnalyticsRange(
      input,
    );

  const [
    orders,
    bills,
    postedWastages,
    inventoryItems,
  ] = await Promise.all([
    prisma.order.findMany({
      where: {
        restaurantId,
        businessDate: {
          gte: range.fromDate,
          lt: range.toExclusive,
        },
      },
      select: {
        id: true,
        status: true,
      },
    }),

    prisma.bill.findMany({
      where: {
        restaurantId,

        status: {
          not:
            BillStatus.CANCELLED,
        },

        businessDate: {
          gte:
            range.fromDate,

          lt:
            range.toExclusive,
        },
      },

      select: {
        id: true,
        businessDate: true,

        grandTotal: true,
        amountPaid: true,
        refundedAmount: true,
        dueAmount: true,

        tax: true,
        discount: true,

        items: {
          select: {
            menuItemId: true,
            itemName: true,
            categoryName: true,
            quantity: true,

            netSales: true,
            costAmount: true,
            grossProfit: true,
          },
        },

        payments: {
          select: {
            method: true,
            amount: true,
          },
        },
      },
    }),

    prisma.wastage.findMany({
      where: {
        restaurantId,

        status:
          WastageStatus.POSTED,

        businessDate: {
          gte:
            range.fromDate,

          lt:
            range.toExclusive,
        },
      },

      select: {
        totalCost: true,

        items: {
          select: {
            reason: true,
            quantity: true,
            totalCost: true,
          },
        },
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
      },

      orderBy: {
        name: "asc",
      },
    }),
  ]);

  const dailyByDate =
    new Map<
      string,
      MutableDailySales
    >();

  for (
    let cursor =
      new Date(
        range.fromDate,
      );
    cursor <
    range.toExclusive;
    cursor =
      addUtcDays(
        cursor,
        1,
      )
  ) {
    const businessDate =
      dateToKey(cursor);

    dailyByDate.set(
      businessDate,
      {
        businessDate,
        billCount: 0,
        grossSales: 0,
        refunds: 0,
        netSales: 0,
        costOfGoodsSold: 0,
        grossProfit: 0,
      },
    );
  }

  const topItemMap =
    new Map<
      string,
      MutableTopItem
    >();

  const paymentMethodMap =
    new Map<
      string,
      MutablePaymentMethod
    >();

  let grossSales = 0;
  let refunds = 0;
  let paymentsReceived = 0;
  let outstandingAmount = 0;

  let taxAmount = 0;
  let discountAmount = 0;

  let costOfGoodsSold = 0;

  for (const bill of bills) {
    const billGross =
      decimalToNumber(
        bill.grandTotal,
      );

    const billRefunds =
      decimalToNumber(
        bill.refundedAmount,
      );

    const billNetSales =
      Math.max(
        0,
        billGross -
          billRefunds,
      );

    const billPayments =
      decimalToNumber(
        bill.amountPaid,
      );


    const billOutstanding =
      decimalToNumber(
        bill.dueAmount,
      );

    const billTax =
      decimalToNumber(
        bill.tax,
      );

    const billDiscount =
      decimalToNumber(
        bill.discount,
      );

    const billCost =
      bill.items.reduce(
        (sum, item) =>
          sum +
          decimalToNumber(
            item.costAmount,
          ),
        0,
      );

    const billProfit =
      billNetSales -
      billCost;

    grossSales +=
      billGross;

    refunds +=
      billRefunds;

    paymentsReceived +=
      billPayments;

    outstandingAmount +=
      billOutstanding;

    taxAmount +=
      billTax;

    discountAmount +=
      billDiscount;

    costOfGoodsSold +=
      billCost;

    if (bill.businessDate) {
      const businessDate =
        dateToKey(
          bill.businessDate,
        );

      const daily =
        dailyByDate.get(
          businessDate,
        );

      if (daily) {
        daily.billCount += 1;

        daily.grossSales +=
          billGross;

        daily.refunds +=
          billRefunds;

        daily.netSales +=
          billNetSales;

        daily.costOfGoodsSold +=
          billCost;

        daily.grossProfit +=
          billProfit;
      }
    }

    for (
      const item of
      bill.items
    ) {
      const itemKey =
        `${item.menuItemId}:${item.itemName}`;

      const existing =
        topItemMap.get(
          itemKey,
        );

      const itemQuantity =
        item.quantity;

      const itemNetSales =
        decimalToNumber(
          item.netSales,
        );

      const itemCost =
        decimalToNumber(
          item.costAmount,
        );

      const itemProfit =
        decimalToNumber(
          item.grossProfit,
        );

      if (existing) {
        existing.quantity +=
          itemQuantity;

        existing.billedNetSales +=
          itemNetSales;

        existing.costAmount +=
          itemCost;

        existing.grossProfit +=
          itemProfit;
      } else {
        topItemMap.set(
          itemKey,
          {
            key: itemKey,

            itemName:
              item.itemName,

            categoryName:
  item.categoryName ??
  "Uncategorized",

            quantity:
              itemQuantity,

            billedNetSales:
              itemNetSales,

            costAmount:
              itemCost,

            grossProfit:
              itemProfit,
          },
        );
      }
    }

    for (
      const payment of
      bill.payments
    ) {
      const method =
        payment.method;

      const amount =
        decimalToNumber(
          payment.amount,
        );

      const existing =
        paymentMethodMap.get(
          method,
        );

      if (existing) {
        existing.transactionCount +=
          1;

        existing.amount +=
          amount;
      } else {
        paymentMethodMap.set(
          method,
          {
            method,
            transactionCount:
              1,
            amount,
          },
        );
      }
    }

  }

  const netSales =
    Math.max(
      0,
      grossSales -
        refunds,
    );

  const netCollections =
    Math.max(
      0,
      paymentsReceived -
        refunds,
    );

  const grossProfit =
    netSales -
    costOfGoodsSold;

  const grossMarginPercent =
    netSales > 0
      ? (
          grossProfit /
          netSales
        ) * 100
      : 0;

  const averageBillValue =
    bills.length > 0
      ? netSales /
        bills.length
      : 0;

  const wastageReasonMap =
    new Map<
      string,
      MutableWastageReason
    >();

  let wastageCost = 0;

  for (
    const wastage of
    postedWastages
  ) {
    wastageCost +=
      decimalToNumber(
        wastage.totalCost,
      );

    for (
      const item of
      wastage.items
    ) {
      const reason =
        item.reason;

      const quantity =
        decimalToNumber(
          item.quantity,
        );

      const totalCost =
        decimalToNumber(
          item.totalCost,
        );

      const existing =
        wastageReasonMap.get(
          reason,
        );

      if (existing) {
        existing.itemCount +=
          1;

        existing.quantity +=
          quantity;

        existing.totalCost +=
          totalCost;
      } else {
        wastageReasonMap.set(
          reason,
          {
            reason,
            itemCount: 1,
            quantity,
            totalCost,
          },
        );
      }
    }
  }

  let inventoryValue = 0;

  const lowStockItems:
    LowStockAnalyticsDto[] =
      [];

  for (
    const item of
    inventoryItems
  ) {
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

    inventoryValue +=
      stockValue;

    const alertLevel =
      Math.max(
        minimumStock,
        reorderLevel,
      );

    if (
      currentStock >
      alertLevel
    ) {
      continue;
    }

    lowStockItems.push({
      id: item.id,
      name: item.name,
      code: item.code,
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
        currentStock <= 0
          ? "OUT_OF_STOCK"
          : "LOW_STOCK",
    });
  }

  lowStockItems.sort(
    (first, second) => {
      if (
        first.status !==
        second.status
      ) {
        return first.status ===
          "OUT_OF_STOCK"
          ? -1
          : 1;
      }

      return (
        first.currentStock -
        second.currentStock
      );
    },
  );

  const dailySales:
    DailySalesAnalyticsDto[] =
      Array.from(
        dailyByDate.values(),
      ).map((daily) => ({
        businessDate:
          daily.businessDate,

        billCount:
          daily.billCount,

        grossSales:
          roundMoney(
            daily.grossSales,
          ),

        refunds:
          roundMoney(
            daily.refunds,
          ),

        netSales:
          roundMoney(
            daily.netSales,
          ),

        costOfGoodsSold:
          canViewProfit
            ? roundMoney(
                daily.costOfGoodsSold,
              )
            : null,

        grossProfit:
          canViewProfit
            ? roundMoney(
                daily.grossProfit,
              )
            : null,
      }));

  const topSellingItems:
    TopSellingItemDto[] =
      Array.from(
        topItemMap.values(),
      )
        .sort(
          (first, second) =>
            second.billedNetSales -
            first.billedNetSales,
        )
        .slice(0, 15)
        .map((item) => ({
          key: item.key,

          itemName:
            item.itemName,

          categoryName:
            item.categoryName,

          quantity:
            item.quantity,

          billedNetSales:
            roundMoney(
              item.billedNetSales,
            ),

          costAmount:
            canViewProfit
              ? roundMoney(
                  item.costAmount,
                )
              : null,

          grossProfit:
            canViewProfit
              ? roundMoney(
                  item.grossProfit,
                )
              : null,
        }));

  const paymentMethods:
    PaymentMethodAnalyticsDto[] =
      Array.from(
        paymentMethodMap.values(),
      )
        .sort(
          (first, second) =>
            second.amount -
            first.amount,
        )
        .map((method) => ({
          method:
            method.method,

          transactionCount:
            method.transactionCount,

          amount:
            roundMoney(
              method.amount,
            ),
        }));

  const wastageReasons:
    WastageReasonAnalyticsDto[] =
      Array.from(
        wastageReasonMap.values(),
      )
        .sort(
          (first, second) =>
            second.totalCost -
            first.totalCost,
        )
        .map((reason) => ({
          reason:
            reason.reason,

          itemCount:
            reason.itemCount,

          quantity:
            roundQuantity(
              reason.quantity,
            ),

          totalCost:
            roundMoney(
              reason.totalCost,
            ),
        }));

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
      orderCount:
        orders.length,

      cancelledOrderCount:
        orders.filter((order) => order.status === "CANCELLED").length,

      billCount:
        bills.length,

      grossSales:
        roundMoney(
          grossSales,
        ),

      refunds:
        roundMoney(
          refunds,
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
          netCollections,
        ),

      outstandingAmount:
        roundMoney(
          outstandingAmount,
        ),

      taxAmount:
        roundMoney(
          taxAmount,
        ),

      discountAmount:
        roundMoney(
          discountAmount,
        ),

      averageBillValue:
        roundMoney(
          averageBillValue,
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
              grossMarginPercent,
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
    },

    dailySales,
    topSellingItems,
    paymentMethods,
    wastageReasons,

    lowStockItems:
      lowStockItems.slice(
        0,
        25,
      ),
  };
}