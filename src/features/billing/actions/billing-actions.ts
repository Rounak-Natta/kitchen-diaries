"use server";

import {
  BillStatus,
  DocumentType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import {
  revalidatePath,
} from "next/cache";

import {
  postBillInventoryConsumption,
} from "@/features/inventory/services/bill-inventory-consumption-service";
import {
  writeAuditLog,
} from "@/lib/audit-log";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  getBusinessDate,
} from "@/lib/business-date";
import {
  nextDocumentNumber,
} from "@/lib/document-number";
import { prisma } from "@/lib/prisma";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";
import {
  withSerializableTransaction,
} from "@/lib/transaction";
import { recordUserBug } from "@/lib/system-event";

import {
  addPaymentSchema,
  createBillSchema,
  type AddPaymentInput,
  type CreateBillInput,
} from "../validations/billing-schemas";

type MoneyInput =
  | string
  | number
  | Prisma.Decimal;

interface PreparedPayment {
  appliedAmount: Prisma.Decimal;
  tenderedAmount: Prisma.Decimal;
  changeReturned: Prisma.Decimal;
}

export type CreateBillResult =
  | {
      success: true;
      billId: string;
      billNumber: string;
      message: string;
    }
  | {
      success: false;
      message: string;
    };

export type AddPaymentResult =
  | {
      success: true;
      paymentId: string;

      amountPaid: number;
      dueAmount: number;
      changeReturned: number;

      paymentStatus:
        | "PENDING"
        | "PARTIAL"
        | "PAID"
        | "PARTIALLY_REFUNDED"
        | "REFUNDED";

      receiptNumber: string | null;
    }
  | {
      success: false;
      message: string;
    };

function toMoney(
  value: MoneyInput,
): Prisma.Decimal {
  const decimal =
    new Prisma.Decimal(value);

  if (!decimal.isFinite()) {
    throw new Error(
      "Invalid monetary value.",
    );
  }

  return decimal.toDecimalPlaces(2);
}

function normalizeOptionalText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    value?.trim();

  return normalized || null;
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

function preparePayment(
  dueAmount: Prisma.Decimal,
  method: PaymentMethod,
  tenderedValue: number,
): PreparedPayment {
  if (dueAmount.lte(0)) {
    throw new Error(
      "This bill has no outstanding amount.",
    );
  }

  const tenderedAmount =
    toMoney(tenderedValue);

  if (tenderedAmount.lte(0)) {
    throw new Error(
      "Payment amount must be greater than zero.",
    );
  }

  if (
    method !== PaymentMethod.CASH &&
    tenderedAmount.gt(dueAmount)
  ) {
    throw new Error(
      "Non-cash payment cannot exceed the due amount.",
    );
  }

  const appliedAmount =
    tenderedAmount.gt(dueAmount)
      ? dueAmount
      : tenderedAmount;

  const changeReturned =
    method === PaymentMethod.CASH
      ? tenderedAmount
          .minus(appliedAmount)
          .toDecimalPlaces(2)
      : toMoney(0);

  return {
    appliedAmount:
      appliedAmount.toDecimalPlaces(2),

    tenderedAmount:
      tenderedAmount.toDecimalPlaces(2),

    changeReturned,
  };
}

function getPaymentStatus(
  amountPaid: Prisma.Decimal,
  dueAmount: Prisma.Decimal,
): PaymentStatus {
  if (dueAmount.lte(0)) {
    return PaymentStatus.PAID;
  }

  if (amountPaid.gt(0)) {
    return PaymentStatus.PARTIAL;
  }

  return PaymentStatus.PENDING;
}

function allocateAmount(
  total: Prisma.Decimal,
  bases: readonly Prisma.Decimal[],
): Prisma.Decimal[] {
  if (bases.length === 0) {
    return [];
  }

  const roundedTotal =
    total.toDecimalPlaces(2);

  const baseTotal =
    bases.reduce(
      (sum, base) =>
        sum.plus(base),
      toMoney(0),
    );

  if (baseTotal.lte(0)) {
    return bases.map(
      (_base, index) =>
        index ===
        bases.length - 1
          ? roundedTotal
          : toMoney(0),
    );
  }

  let allocated =
    toMoney(0);

  return bases.map(
    (base, index) => {
      if (
        index ===
        bases.length - 1
      ) {
        return roundedTotal
          .minus(allocated)
          .toDecimalPlaces(2);
      }

      const share =
        roundedTotal
          .mul(base)
          .div(baseTotal)
          .toDecimalPlaces(2);

      allocated =
        allocated.plus(share);

      return share;
    },
  );
}

function safeActionError(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const allowedMessages = [
    "order was not found",
    "order cannot be billed",
    "empty order",
    "outstanding amount",
    "payment amount",
    "non-cash payment",
    "bill was not found",
    "bill is not active",
    "bill is already paid",
    "daily document",
    "insufficient stock",
    "active recipe",
    "has no ingredients",
    "direct inventory item",
    "inventory item",
    "inventory unit",
    "bill item was not found",
    "inventory posting",
    "recipe consumption",
    "idempotency key",
  ];

  const safe =
    allowedMessages.some(
      (message) =>
        error.message
          .toLowerCase()
          .includes(message),
    );

  return safe
    ? error.message
    : fallback;
}

export async function createBill(
  data: CreateBillInput,
): Promise<CreateBillResult> {
  const user =
    await getAuthUser();

  if (!user) {
    return {
      success: false,
      message: "Unauthorized.",
    };
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.BILLING_CREATE,
    )
  ) {
    return {
      success: false,

      message:
        "You do not have permission to create bills.",
    };
  }

  if (!user.restaurantId) {
    return {
      success: false,

      message:
        "No restaurant is assigned to this user.",
    };
  }

  const validation =
    createBillSchema.safeParse(
      data,
    );

  if (!validation.success) {
    return {
      success: false,

      message:
        validation.error.issues[0]
          ?.message ??
        "Invalid billing information.",
    };
  }

  const input =
    validation.data;

  const restaurantId =
    user.restaurantId;

  const createdAt =
    new Date();

  try {
    const result =
      await withSerializableTransaction(
        async (transaction) => {
          const existingByKey =
            await transaction.bill.findUnique({
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
                billNumber: true,
                orderId: true,
              },
            });

          if (existingByKey) {
            if (
              existingByKey.orderId !==
              input.orderId
            ) {
              throw new Error(
                "This idempotency key is already used for another bill.",
              );
            }

            return {
              id: existingByKey.id,

              billNumber:
                existingByKey.billNumber,

              alreadyExisted: true,
            };
          }

          const existingByOrder =
            await transaction.bill.findUnique({
              where: {
                orderId:
                  input.orderId,
              },

              select: {
                id: true,
                billNumber: true,
              },
            });

          if (existingByOrder) {
            return {
              ...existingByOrder,
              alreadyExisted: true,
            };
          }

          const order =
            await transaction.order.findFirst({
              where: {
                id: input.orderId,
                restaurantId,
              },

              select: {
                id: true,
                orderNumber: true,
                status: true,
                orderType: true,
                tableNumber: true,

                customerName: true,
                customerPhone: true,
                customerAddress: true,

                subtotal: true,
                taxRate: true,
                tax: true,

                discountType: true,
                discountValue: true,
                discount: true,
                discountReason: true,

                serviceCharge: true,
                deliveryCharge: true,
                packagingCharge: true,

                total: true,
                notes: true,

                items: {
                  select: {
                    id: true,
                    menuItemId: true,
                    itemName: true,
                    quantity: true,

                    basePrice: true,
                    variationPrice: true,
                    addonPrice: true,
                    totalPrice: true,

                    notes: true,

                    menuItem: {
                      select: {
                        category: {
                          select: {
                            name: true,
                          },
                        },
                      },
                    },

                    variationOption: {
                      select: {
                        name: true,
                      },
                    },

                    addons: {
                      select: {
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
            throw new Error(
              "Order was not found for this restaurant.",
            );
          }

          if (
            order.status ===
              OrderStatus.CANCELLED ||
            order.status ===
              OrderStatus.COMPLETED
          ) {
            throw new Error(
              `Order cannot be billed while its status is ${order.status}.`,
            );
          }

          if (
            order.items.length === 0
          ) {
            throw new Error(
              "Cannot bill an empty order.",
            );
          }

          const businessDate =
            getBusinessDate(
              createdAt,
            );

          const billNumber =
            await nextDocumentNumber(
              transaction,
              {
                restaurantId,

                documentType:
                  DocumentType.BILL,

                businessDate,
              },
            );

          const grandTotal =
            order.total.toDecimalPlaces(
              2,
            );

          const preparedPayment =
            input.payment
              ? preparePayment(
                  grandTotal,

                  input.payment.method,

                  input.payment
                    .tenderedAmount,
                )
              : null;

          const amountPaid =
            preparedPayment
              ?.appliedAmount ??
            toMoney(0);

          const changeReturned =
            preparedPayment
              ?.changeReturned ??
            toMoney(0);

          const dueAmount =
            grandTotal
              .minus(amountPaid)
              .toDecimalPlaces(2);

          const paymentStatus =
            getPaymentStatus(
              amountPaid,
              dueAmount,
            );

          const receiptNumber =
            preparedPayment
              ? await nextDocumentNumber(
                  transaction,
                  {
                    restaurantId,

                    documentType:
                      DocumentType.RECEIPT,

                    businessDate,
                  },
                )
              : null;

          const grossAmounts =
            order.items.map(
              (item) =>
                item.totalPrice.toDecimalPlaces(
                  2,
                ),
            );

          const discountAllocations =
            allocateAmount(
              order.discount,
              grossAmounts,
            );

          const netSalesAmounts =
            grossAmounts.map(
              (
                grossAmount,
                index,
              ) =>
                grossAmount
                  .minus(
                    discountAllocations[
                      index
                    ] ??
                      toMoney(0),
                  )
                  .toDecimalPlaces(2),
            );

          const taxAllocations =
            allocateAmount(
              order.tax,
              netSalesAmounts,
            );

          const bill =
            await transaction.bill.create({
              data: {
                billNumber,
                receiptNumber,

                idempotencyKey:
                  input.idempotencyKey,

                orderId:
                  order.id,

                restaurantId,

                createdById:
                  user.id,

                orderType:
                  order.orderType,

                tableNumber:
                  order.tableNumber,

                customerName:
                  normalizeOptionalText(
                    input.customerName,
                  ) ??
                  order.customerName,

                customerPhone:
                  normalizeOptionalText(
                    input.customerPhone,
                  ) ??
                  order.customerPhone,

                customerAddress:
                  normalizeOptionalText(
                    input.customerAddress,
                  ) ??
                  order.customerAddress,

                subtotal:
                  order.subtotal,

                taxRate:
                  order.taxRate,

                tax:
                  order.tax,

                discountType:
                  order.discountType,

                discountValue:
                  order.discountValue,

                discount:
                  order.discount,

                discountReason:
                  order.discountReason,

                serviceCharge:
                  order.serviceCharge,

                deliveryCharge:
                  order.deliveryCharge,

                packagingCharge:
                  order.packagingCharge,

                roundOff:
                  toMoney(0),

                grandTotal,
                amountPaid,

                refundedAmount:
                  toMoney(0),

                changeReturned,
                dueAmount,
                paymentStatus,
                businessDate,

                paidAt:
                  paymentStatus ===
                  PaymentStatus.PAID
                    ? createdAt
                    : null,

                notes:
                  normalizeOptionalText(
                    input.notes,
                  ) ??
                  order.notes,

                createdAt,

                items: {
                  create:
                    order.items.map(
                      (
                        item,
                        index,
                      ) => {
                        const grossAmount =
                          grossAmounts[
                            index
                          ] ??
                          toMoney(0);

                        const discountAmount =
                          discountAllocations[
                            index
                          ] ??
                          toMoney(0);

                        const netSales =
                          netSalesAmounts[
                            index
                          ] ??
                          toMoney(0);

                        const taxAmount =
                          taxAllocations[
                            index
                          ] ??
                          toMoney(0);

                        const unitPrice =
                          item.basePrice
                            .plus(
                              item.variationPrice,
                            )
                            .plus(
                              item.addonPrice,
                            )
                            .toDecimalPlaces(
                              2,
                            );

                        return {
                          orderItemId:
                            item.id,

                          menuItemId:
                            item.menuItemId,

                          itemName:
                            item.itemName,

                          categoryName:
                            item.menuItem
                              .category
                              .name,

                          quantity:
                            item.quantity,

                          unitPrice,

                          addonPrice:
                            item.addonPrice,

                          variationPrice:
                            item.variationPrice,

                          grossAmount,
                          discountAmount,
                          taxAmount,
                          netSales,

                          totalPrice:
                            netSales
                              .plus(
                                taxAmount,
                              )
                              .toDecimalPlaces(
                                2,
                              ),

                          costAmount:
                            toMoney(0),

                          grossProfit:
                            toMoney(0),

                          grossMarginPct:
                            toMoney(0),

                          notes:
                            item.notes,

                          variationName:
                            item
                              .variationOption
                              ?.name ??
                            null,

                          addonNames:
                            item.addons.map(
                              (addon) =>
                                addon
                                  .addon
                                  .name,
                            ),
                        };
                      },
                    ),
                },

                payments:
                  preparedPayment &&
                  input.payment
                    ? {
                        create: {
                          idempotencyKey:
                            input
                              .payment
                              .idempotencyKey,

                          method:
                            input
                              .payment
                              .method,

                          amount:
                            preparedPayment
                              .appliedAmount,

                          tenderedAmount:
                            preparedPayment
                              .tenderedAmount,

                          referenceNo:
                            normalizeOptionalText(
                              input
                                .payment
                                .referenceNo,
                            ),

                          notes:
                            normalizeOptionalText(
                              input
                                .payment
                                .notes,
                            ),

                          recordedById:
                            user.id,

                          createdAt,
                        },
                      }
                    : undefined,
              },

              select: {
                id: true,
                billNumber: true,
              },
            });

          const orderStatus =
            paymentStatus ===
            PaymentStatus.PAID
              ? OrderStatus.COMPLETED
              : OrderStatus.BILLED;

          await transaction.order.update({
            where: {
              id: order.id,
            },

            data: {
              status:
                orderStatus,

              billedAt:
                createdAt,

              completedAt:
                orderStatus ===
                OrderStatus.COMPLETED
                  ? createdAt
                  : null,

              version: {
                increment: 1,
              },
            },
          });

          const inventoryResult =
            await postBillInventoryConsumption(
              transaction,
              {
                restaurantId,

                createdById:
                  user.id,

                billId:
                  bill.id,

                businessDate,
              },
            );

          await writeAuditLog(
            transaction,
            {
              restaurantId,
              userId:
                user.id,

              module:
                "BILLING",

              action:
                "CREATE_BILL",

              entityType:
                "Bill",

              entityId:
                bill.id,

              newData: {
                billNumber:
                  bill.billNumber,

                receiptNumber,

                orderId:
                  order.id,

                orderNumber:
                  order.orderNumber,

                grandTotal:
                  grandTotal.toString(),

                amountPaid:
                  amountPaid.toString(),

                dueAmount:
                  dueAmount.toString(),

                changeReturned:
                  changeReturned.toString(),

                paymentStatus,

                paymentMethod:
                  input.payment
                    ?.method ??
                  null,

                inventoryPosted:
                  !inventoryResult
                    .alreadyPosted,

                inventoryTransactionCount:
                  inventoryResult
                    .transactionCount,

                inventoryCost:
                  inventoryResult
                    .totalCost
                    .toString(),

                businessDate:
                  businessDate
                    .toISOString()
                    .slice(0, 10),
              },
            },
          );

          return {
            id: bill.id,

            billNumber:
              bill.billNumber,

            alreadyExisted: false,
          };
        },
      );

    revalidatePath("/orders");
    revalidatePath("/billing");
    revalidatePath("/inventory");

    revalidatePath(
      `/billing/create/${input.orderId}`,
    );

    revalidatePath(
      "/inventory/transactions",
    );

    return {
      success: true,

      billId:
        result.id,

      billNumber:
        result.billNumber,

      message:
        result.alreadyExisted
          ? "Bill already exists."
          : "Bill created successfully.",
    };
  } catch (error: unknown) {
    if (
      isUniqueConstraintError(
        error,
      )
    ) {
      const existing =
        await prisma.bill.findFirst({
          where: {
            restaurantId,

            OR: [
              {
                orderId:
                  input.orderId,
              },
              {
                idempotencyKey:
                  input.idempotencyKey,
              },
            ],
          },

          select: {
            id: true,
            billNumber: true,
          },
        });

      if (existing) {
        return {
          success: true,

          billId:
            existing.id,

          billNumber:
            existing.billNumber,

          message:
            "Bill already exists.",
        };
      }
    }

    console.error(
      "CREATE_BILL_ERROR:",
      error,
    );

    await recordUserBug({
      severity: "ERROR",
      source: "BILL_CREATE",
      message:
        error instanceof Error
          ? error.message
          : "Unexpected bill creation failure.",
      restaurantId,
      metadata: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        orderId: input.orderId,
        action: "CREATE_BILL",
        errorName: error instanceof Error ? error.name : "UnknownError",
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    return {
      success: false,

      message:
        safeActionError(
          error,
          "The bill could not be created. Please try again.",
        ),
    };
  }
}

export async function addPaymentToBill(
  billId: string,
  data: AddPaymentInput,
): Promise<AddPaymentResult> {
  const user =
    await getAuthUser();

  if (!user) {
    return {
      success: false,
      message: "Unauthorized.",
    };
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.BILLING_PAYMENT_ADD,
    )
  ) {
    return {
      success: false,

      message:
        "You do not have permission to record payments.",
    };
  }

  if (!user.restaurantId) {
    return {
      success: false,

      message:
        "No restaurant is assigned to this user.",
    };
  }

  const validation =
    addPaymentSchema.safeParse(
      data,
    );

  if (!validation.success) {
    return {
      success: false,

      message:
        validation.error.issues[0]
          ?.message ??
        "Invalid payment information.",
    };
  }

  const input =
    validation.data;

  const restaurantId =
    user.restaurantId;

  const createdAt =
    new Date();

  try {
    const result =
      await withSerializableTransaction(
        async (transaction) => {
          const bill =
            await transaction.bill.findFirst({
              where: {
                id: billId,
                restaurantId,
              },

              select: {
                id: true,
                billNumber: true,
                orderId: true,
                receiptNumber: true,
                status: true,

                amountPaid: true,
                changeReturned: true,
                dueAmount: true,
                paymentStatus: true,
                businessDate: true,
              },
            });

          if (!bill) {
            throw new Error(
              "Bill was not found.",
            );
          }

          const existingPayment =
            await transaction.billPayment.findUnique({
              where: {
                billId_idempotencyKey:
                  {
                    billId:
                      bill.id,

                    idempotencyKey:
                      input.idempotencyKey,
                  },
              },

              select: {
                id: true,
              },
            });

          if (existingPayment) {
            return {
              paymentId:
                existingPayment.id,

              amountPaid:
                bill.amountPaid,

              dueAmount:
                bill.dueAmount,

              changeReturned:
                bill.changeReturned,

              paymentStatus:
                bill.paymentStatus,

              receiptNumber:
                bill.receiptNumber,
            };
          }

          if (
            bill.status !==
            BillStatus.ACTIVE
          ) {
            throw new Error(
              "Bill is not active.",
            );
          }

          if (
            bill.paymentStatus ===
              PaymentStatus.PAID ||
            bill.dueAmount.lte(0)
          ) {
            throw new Error(
              "Bill is already paid.",
            );
          }

          const previousAmountPaid =
            bill.amountPaid;

          const previousDueAmount =
            bill.dueAmount;

          const previousPaymentStatus =
            bill.paymentStatus;

          const payment =
            preparePayment(
              bill.dueAmount,
              input.method,
              input.tenderedAmount,
            );

          const newAmountPaid =
            bill.amountPaid
              .plus(
                payment.appliedAmount,
              )
              .toDecimalPlaces(2);

          const newDueAmount =
            bill.dueAmount
              .minus(
                payment.appliedAmount,
              )
              .toDecimalPlaces(2);

          const newChangeReturned =
            bill.changeReturned
              .plus(
                payment.changeReturned,
              )
              .toDecimalPlaces(2);

          const paymentStatus =
            getPaymentStatus(
              newAmountPaid,
              newDueAmount,
            );

          let receiptNumber =
            bill.receiptNumber;

          if (!receiptNumber) {
            receiptNumber =
              await nextDocumentNumber(
                transaction,
                {
                  restaurantId,

                  documentType:
                    DocumentType.RECEIPT,

                  businessDate:
                    bill.businessDate ??
                    getBusinessDate(
                      createdAt,
                    ),
                },
              );
          }

          const createdPayment =
            await transaction.billPayment.create({
              data: {
                billId:
                  bill.id,

                idempotencyKey:
                  input.idempotencyKey,

                method:
                  input.method,

                amount:
                  payment.appliedAmount,

                tenderedAmount:
                  payment.tenderedAmount,

                referenceNo:
                  normalizeOptionalText(
                    input.referenceNo,
                  ),

                notes:
                  normalizeOptionalText(
                    input.notes,
                  ),

                recordedById:
                  user.id,

                createdAt,
              },

              select: {
                id: true,
              },
            });

          await transaction.bill.update({
            where: {
              id: bill.id,
            },

            data: {
              receiptNumber,

              amountPaid:
                newAmountPaid,

              dueAmount:
                newDueAmount,

              changeReturned:
                newChangeReturned,

              paymentStatus,

              paidAt:
                paymentStatus ===
                PaymentStatus.PAID
                  ? createdAt
                  : null,
            },
          });

          await transaction.order.update({
            where: {
              id: bill.orderId,
            },

            data: {
              status:
                paymentStatus ===
                PaymentStatus.PAID
                  ? OrderStatus.COMPLETED
                  : OrderStatus.BILLED,

              completedAt:
                paymentStatus ===
                PaymentStatus.PAID
                  ? createdAt
                  : null,

              version: {
                increment: 1,
              },
            },
          });

          await writeAuditLog(
            transaction,
            {
              restaurantId,
              userId:
                user.id,

              module:
                "BILLING",

              action:
                "RECORD_PAYMENT",

              entityType:
                "BillPayment",

              entityId:
                createdPayment.id,

              oldData: {
                billId:
                  bill.id,

                amountPaid:
                  previousAmountPaid.toString(),

                dueAmount:
                  previousDueAmount.toString(),

                paymentStatus:
                  previousPaymentStatus,
              },

              newData: {
                billId:
                  bill.id,

                billNumber:
                  bill.billNumber,

                receiptNumber,

                method:
                  input.method,

                appliedAmount:
                  payment.appliedAmount.toString(),

                tenderedAmount:
                  payment.tenderedAmount.toString(),

                paymentChange:
                  payment.changeReturned.toString(),

                totalChangeReturned:
                  newChangeReturned.toString(),

                amountPaid:
                  newAmountPaid.toString(),

                dueAmount:
                  newDueAmount.toString(),

                paymentStatus,

                referenceNo:
                  normalizeOptionalText(
                    input.referenceNo,
                  ),
              },
            },
          );

          return {
            paymentId:
              createdPayment.id,

            amountPaid:
              newAmountPaid,

            dueAmount:
              newDueAmount,

            changeReturned:
              newChangeReturned,

            paymentStatus,
            receiptNumber,
          };
        },
      );

    revalidatePath(
      `/billing/${billId}`,
    );

    revalidatePath(
      `/billing/${billId}/adjustments`,
    );

    revalidatePath("/billing");
    revalidatePath("/orders");

    return {
      success: true,

      paymentId:
        result.paymentId,

      amountPaid:
        Number(
          result.amountPaid,
        ),

      dueAmount:
        Number(
          result.dueAmount,
        ),

      changeReturned:
        Number(
          result.changeReturned,
        ),

      paymentStatus:
        result.paymentStatus,

      receiptNumber:
        result.receiptNumber,
    };
  } catch (error: unknown) {
    if (
      isUniqueConstraintError(
        error,
      )
    ) {
      const existingPayment =
        await prisma.billPayment.findFirst({
          where: {
            billId,

            idempotencyKey:
              input.idempotencyKey,

            bill: {
              restaurantId,
            },
          },

          select: {
            id: true,

            bill: {
              select: {
                amountPaid: true,
                dueAmount: true,
                changeReturned: true,
                paymentStatus: true,
                receiptNumber: true,
              },
            },
          },
        });

      if (existingPayment) {
        return {
          success: true,

          paymentId:
            existingPayment.id,

          amountPaid:
            Number(
              existingPayment
                .bill
                .amountPaid,
            ),

          dueAmount:
            Number(
              existingPayment
                .bill
                .dueAmount,
            ),

          changeReturned:
            Number(
              existingPayment
                .bill
                .changeReturned,
            ),

          paymentStatus:
            existingPayment
              .bill
              .paymentStatus,

          receiptNumber:
            existingPayment
              .bill
              .receiptNumber,
        };
      }
    }

    console.error(
      "ADD_PAYMENT_ERROR:",
      error,
    );

    await recordUserBug({
      severity: "ERROR",
      source: "BILL_PAYMENT",
      message:
        error instanceof Error
          ? error.message
          : "Unexpected payment failure.",
      restaurantId,
      metadata: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        billId,
        action: "ADD_PAYMENT",
        errorName: error instanceof Error ? error.name : "UnknownError",
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    return {
      success: false,

      message:
        safeActionError(
          error,
          "The payment could not be recorded. Please try again.",
        ),
    };
  }
}