"use server";

import {
  BillStatus,
  DocumentType,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

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

import {
  restoreCancelledBillInventory,
} from "../services/restore-cancelled-bill-inventory";
import {
  cancelBillSchema,
  refundBillSchema,
  type CancelBillInput,
  type RefundBillInput,
} from "../validations/billing-adjustment-schemas";

export type CancelBillResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

export type RefundBillResult =
  | {
      success: true;
      refundId: string;
      refundNumber: string;
      refundedAmount: number;
      refundableAmount: number;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

function toMoney(
  value:
    | number
    | string
    | Prisma.Decimal,
): Prisma.Decimal {
  const decimal =
    new Prisma.Decimal(value);

  if (
    !decimal.isFinite() ||
    decimal.lt(0)
  ) {
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

function safeAdjustmentError(
  error: unknown,
): string {
  if (!(error instanceof Error)) {
    return "The billing operation could not be completed.";
  }

  const allowedMessages = [
    "bill was not found",
    "bill is already cancelled",
    "refunded bills cannot be cancelled",
    "paid bills cannot be cancelled",
    "bill is cancelled",
    "bill is already fully refunded",
    "only fully paid bills can be refunded",
    "refund amount",
    "refundable amount",
    "inventory restoration",
    "original inventory transaction",
    "inventory item",
    "daily document",
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
    : "The billing operation could not be completed.";
}

export async function cancelBill(
  billId: string,
  data: CancelBillInput,
): Promise<CancelBillResult> {
  const user =
    await getAuthUser();

  if (!user) {
    return {
      success: false,
      error: "Unauthorized.",
    };
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.BILLING_CANCEL,
    )
  ) {
    return {
      success: false,
      error:
        "You do not have permission to cancel bills.",
    };
  }

  if (!user.restaurantId) {
    return {
      success: false,
      error:
        "No restaurant is assigned to this user.",
    };
  }

  const validation =
    cancelBillSchema.safeParse(data);

  if (!validation.success) {
    return {
      success: false,

      error:
        validation.error.issues[0]
          ?.message ??
        "Invalid cancellation information.",
    };
  }

  const input =
    validation.data;

  const restaurantId =
    user.restaurantId;

  const cancelledAt =
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
                status: true,
                orderId: true,

                grandTotal: true,
                amountPaid: true,
                refundedAmount: true,
                dueAmount: true,
                paymentStatus: true,

                order: {
                  select: {
                    orderNumber: true,
                    status: true,
                    inventoryStatus:
                      true,
                  },
                },
              },
            });

          if (!bill) {
            throw new Error(
              "Bill was not found.",
            );
          }

          if (
            bill.status ===
            BillStatus.CANCELLED
          ) {
            return {
              alreadyCancelled:
                true,

              restoredTransactionCount:
                0,

              restoredCost:
                new Prisma.Decimal(
                  0,
                ),
            };
          }

          if (
            bill.status ===
              BillStatus.REFUNDED ||
            bill.status ===
              BillStatus.PARTIALLY_REFUNDED
          ) {
            throw new Error(
              "Refunded bills cannot be cancelled.",
            );
          }

          const unrefundedPayments =
            bill.amountPaid
              .minus(
                bill.refundedAmount,
              )
              .toDecimalPlaces(2);

          if (
            unrefundedPayments.gt(0)
          ) {
            throw new Error(
              "Paid bills cannot be cancelled. Refund the payment instead.",
            );
          }

          const businessDate =
            getBusinessDate(
              cancelledAt,
            );

          const inventoryResult =
            await restoreCancelledBillInventory(
              transaction,
              {
                restaurantId,

                createdById:
                  user.id,

                billId:
                  bill.id,

                businessDate,

                reason:
                  input.reason,
              },
            );

          await transaction.bill.update({
            where: {
              id: bill.id,
            },

            data: {
              status:
                BillStatus.CANCELLED,

              dueAmount:
                toMoney(0),

              paymentStatus:
                PaymentStatus.PENDING,

              paidAt: null,

              cancelledAt,

              cancellationReason:
                input.reason,

              cancelledById:
                user.id,
            },
          });

          await transaction.order.update({
            where: {
              id: bill.orderId,
            },

            data: {
              status:
                OrderStatus.CANCELLED,

              inventoryStatus:
                inventoryResult.inventoryStatus,

              cancelledAt,

              cancellationReason:
                input.reason,

              cancelledById:
                user.id,

              completedAt: null,

              version: {
                increment: 1,
              },
            },
          });

          await writeAuditLog(
            transaction,
            {
              restaurantId,
              userId: user.id,

              module: "BILLING",
              action: "CANCEL_BILL",

              entityType: "Bill",
              entityId: bill.id,

              oldData: {
                billStatus:
                  bill.status,

                orderStatus:
                  bill.order.status,

                inventoryStatus:
                  bill.order
                    .inventoryStatus,

                dueAmount:
                  bill.dueAmount.toString(),

                paymentStatus:
                  bill.paymentStatus,
              },

              newData: {
                billNumber:
                  bill.billNumber,

                orderNumber:
                  bill.order
                    .orderNumber,

                billStatus:
                  BillStatus.CANCELLED,

                orderStatus:
                  OrderStatus.CANCELLED,

                inventoryStatus:
                  inventoryResult
                    .inventoryStatus,

                dueAmount: "0.00",

                cancellationReason:
                  input.reason,

                cancelledAt:
                  cancelledAt.toISOString(),

                inventoryAlreadyRestored:
                  inventoryResult
                    .alreadyRestored,

                inventoryRestorationTransactions:
                  inventoryResult
                    .restoredTransactionCount,

                restoredInventoryCost:
                  inventoryResult
                    .restoredCost
                    .toString(),
              },

              reason:
                input.reason,
            },
          );

          return {
            alreadyCancelled:
              false,

            restoredTransactionCount:
              inventoryResult
                .restoredTransactionCount,

            restoredCost:
              inventoryResult
                .restoredCost,
          };
        },
      );

    revalidatePath("/billing");
    revalidatePath("/orders");
    revalidatePath("/inventory");

    revalidatePath(
      "/inventory/transactions",
    );

    revalidatePath(
      `/billing/${billId}`,
    );

    revalidatePath(
      `/billing/${billId}/adjustments`,
    );

    return {
      success: true,

      message:
        result.alreadyCancelled
          ? "Bill is already cancelled."
          : result.restoredTransactionCount >
              0
            ? "Bill cancelled and inventory restored successfully."
            : "Bill cancelled successfully.",
    };
  } catch (error: unknown) {
    console.error(
      "CANCEL_BILL_ERROR:",
      error,
    );

    return {
      success: false,
      error:
        safeAdjustmentError(
          error,
        ),
    };
  }
}

export async function refundBill(
  billId: string,
  data: RefundBillInput,
): Promise<RefundBillResult> {
  const user =
    await getAuthUser();

  if (!user) {
    return {
      success: false,
      error: "Unauthorized.",
    };
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.BILLING_REFUND,
    )
  ) {
    return {
      success: false,
      error:
        "You do not have permission to refund bills.",
    };
  }

  if (!user.restaurantId) {
    return {
      success: false,
      error:
        "No restaurant is assigned to this user.",
    };
  }

  const validation =
    refundBillSchema.safeParse(data);

  if (!validation.success) {
    return {
      success: false,

      error:
        validation.error.issues[0]
          ?.message ??
        "Invalid refund information.",
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
                status: true,
                orderId: true,

                amountPaid: true,
                refundedAmount: true,
                dueAmount: true,
                paymentStatus: true,

                order: {
                  select: {
                    orderNumber: true,
                  },
                },
              },
            });

          if (!bill) {
            throw new Error(
              "Bill was not found.",
            );
          }

          const existingRefund =
            await transaction.billRefund.findUnique({
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
                refundNumber: true,
                amount: true,
              },
            });

          if (existingRefund) {
            const refundableAmount =
              bill.amountPaid
                .minus(
                  bill.refundedAmount,
                )
                .toDecimalPlaces(2);

            return {
              refundId:
                existingRefund.id,

              refundNumber:
                existingRefund
                  .refundNumber,

              refundedAmount:
                bill.refundedAmount,

              refundableAmount,

              alreadyExisted:
                true,
            };
          }

          if (
            bill.status ===
            BillStatus.CANCELLED
          ) {
            throw new Error(
              "Bill is cancelled and cannot be refunded.",
            );
          }

          if (
            bill.status ===
            BillStatus.REFUNDED ||
            bill.paymentStatus ===
              PaymentStatus.REFUNDED
          ) {
            throw new Error(
              "Bill is already fully refunded.",
            );
          }

          const hasRefundablePaymentStatus =
  bill.paymentStatus ===
    PaymentStatus.PAID ||
  bill.paymentStatus ===
    PaymentStatus.PARTIALLY_REFUNDED;

if (
  bill.dueAmount.gt(0) ||
  !hasRefundablePaymentStatus
) {
  throw new Error(
    "Only fully paid bills can be refunded.",
  );
}

          const refundableAmount =
            bill.amountPaid
              .minus(
                bill.refundedAmount,
              )
              .toDecimalPlaces(2);

          if (
            refundableAmount.lte(0)
          ) {
            throw new Error(
              "Bill is already fully refunded.",
            );
          }

          const refundAmount =
            toMoney(
              input.amount,
            );

          if (
            refundAmount.gt(
              refundableAmount,
            )
          ) {
            throw new Error(
              `Refund amount cannot exceed the refundable amount of ₹${refundableAmount.toString()}.`,
            );
          }

          const businessDate =
            getBusinessDate(
              createdAt,
            );

          const refundNumber =
            await nextDocumentNumber(
              transaction,
              {
                restaurantId,

                documentType:
                  DocumentType.REFUND,

                businessDate,
              },
            );

          const refund =
            await transaction.billRefund.create({
              data: {
                refundNumber,

                billId:
                  bill.id,

                idempotencyKey:
                  input.idempotencyKey,

                amount:
                  refundAmount,

                method:
                  input.method,

                reason:
                  input.reason,

                referenceNo:
                  normalizeOptionalText(
                    input.referenceNo,
                  ),

                notes:
                  normalizeOptionalText(
                    input.notes,
                  ),

                createdById:
                  user.id,

                createdAt,
              },

              select: {
                id: true,
                refundNumber: true,
              },
            });

          const newRefundedAmount =
            bill.refundedAmount
              .plus(
                refundAmount,
              )
              .toDecimalPlaces(2);

          const newRefundableAmount =
            bill.amountPaid
              .minus(
                newRefundedAmount,
              )
              .toDecimalPlaces(2);

          const isFullyRefunded =
            newRefundableAmount.lte(
              0,
            );

          const billStatus =
            isFullyRefunded
              ? BillStatus.REFUNDED
              : BillStatus.PARTIALLY_REFUNDED;

          const paymentStatus =
            isFullyRefunded
              ? PaymentStatus.REFUNDED
              : PaymentStatus.PARTIALLY_REFUNDED;

          await transaction.bill.update({
            where: {
              id: bill.id,
            },

            data: {
              refundedAmount:
                newRefundedAmount,

              status:
                billStatus,

              paymentStatus,
            },
          });

          await writeAuditLog(
            transaction,
            {
              restaurantId,
              userId: user.id,

              module: "BILLING",
              action: "CREATE_REFUND",

              entityType:
                "BillRefund",

              entityId:
                refund.id,

              oldData: {
                billId:
                  bill.id,

                billStatus:
                  bill.status,

                paymentStatus:
                  bill.paymentStatus,

                refundedAmount:
                  bill.refundedAmount.toString(),

                refundableAmount:
                  refundableAmount.toString(),
              },

              newData: {
                billId:
                  bill.id,

                billNumber:
                  bill.billNumber,

                orderNumber:
                  bill.order
                    .orderNumber,

                refundNumber:
                  refund.refundNumber,

                refundAmount:
                  refundAmount.toString(),

                refundMethod:
                  input.method,

                reason:
                  input.reason,

                referenceNo:
                  normalizeOptionalText(
                    input.referenceNo,
                  ),

                billStatus,

                paymentStatus,

                refundedAmount:
                  newRefundedAmount.toString(),

                refundableAmount:
                  newRefundableAmount.toString(),

                inventoryRestored:
                  false,

                createdAt:
                  createdAt.toISOString(),
              },

              reason:
                input.reason,
            },
          );

          return {
            refundId:
              refund.id,

            refundNumber:
              refund.refundNumber,

            refundedAmount:
              newRefundedAmount,

            refundableAmount:
              newRefundableAmount,

            alreadyExisted:
              false,
          };
        },
      );

    revalidatePath("/billing");
    revalidatePath("/orders");

    revalidatePath(
      `/billing/${billId}`,
    );

    revalidatePath(
      `/billing/${billId}/adjustments`,
    );

    return {
      success: true,

      refundId:
        result.refundId,

      refundNumber:
        result.refundNumber,

      refundedAmount:
        Number(
          result.refundedAmount,
        ),

      refundableAmount:
        Number(
          result.refundableAmount,
        ),

      message:
        result.alreadyExisted
          ? "Refund already exists."
          : "Refund recorded successfully.",
    };
  } catch (error: unknown) {
    if (
      isUniqueConstraintError(
        error,
      )
    ) {
      const existingRefund =
        await prisma.billRefund.findFirst({
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
            refundNumber: true,

            bill: {
              select: {
                amountPaid: true,
                refundedAmount: true,
              },
            },
          },
        });

      if (existingRefund) {
        const refundableAmount =
          existingRefund.bill
            .amountPaid
            .minus(
              existingRefund.bill
                .refundedAmount,
            )
            .toDecimalPlaces(2);

        return {
          success: true,

          refundId:
            existingRefund.id,

          refundNumber:
            existingRefund
              .refundNumber,

          refundedAmount:
            Number(
              existingRefund.bill
                .refundedAmount,
            ),

          refundableAmount:
            Number(
              refundableAmount,
            ),

          message:
            "Refund already exists.",
        };
      }
    }

    console.error(
      "REFUND_BILL_ERROR:",
      error,
    );

    return {
      success: false,
      error:
        safeAdjustmentError(
          error,
        ),
    };
  }
}