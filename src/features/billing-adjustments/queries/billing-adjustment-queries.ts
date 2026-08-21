import {
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface BillAdjustmentDataDto {
  id: string;
  billNumber: string;

  status:
    | "ACTIVE"
    | "CANCELLED"
    | "PARTIALLY_REFUNDED"
    | "REFUNDED";

  paymentStatus:
    | "PENDING"
    | "PARTIAL"
    | "PAID"
    | "PARTIALLY_REFUNDED"
    | "REFUNDED";

  orderNumber: string;

  grandTotal: number;
  amountPaid: number;
  refundedAmount: number;
  refundableAmount: number;
  dueAmount: number;

  inventoryStatus:
    | "NOT_DEDUCTED"
    | "DEDUCTED"
    | "PARTIALLY_RESTORED"
    | "RESTORED";

  cancellationReason: string | null;
  cancelledAt: string | null;

  refunds: Array<{
    id: string;
    refundNumber: string;
    amount: number;
    method: string;
    reason: string;
    referenceNo: string | null;
    notes: string | null;
    createdByName: string;
    createdAt: string;
  }>;
}

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

export async function getBillAdjustmentData(
  restaurantId: string,
  billId: string,
): Promise<BillAdjustmentDataDto | null> {
  const bill =
    await prisma.bill.findFirst({
      where: {
        id: billId,
        restaurantId,
      },

      select: {
        id: true,
        billNumber: true,
        status: true,
        paymentStatus: true,

        grandTotal: true,
        amountPaid: true,
        refundedAmount: true,
        dueAmount: true,

        cancellationReason: true,
        cancelledAt: true,

        order: {
          select: {
            orderNumber: true,
            inventoryStatus: true,
          },
        },

        refunds: {
          select: {
            id: true,
            refundNumber: true,
            amount: true,
            method: true,
            reason: true,
            referenceNo: true,
            notes: true,
            createdAt: true,

            createdBy: {
              select: {
                name: true,
              },
            },
          },

          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

  if (!bill) {
    return null;
  }

  const amountPaid =
    decimalToNumber(
      bill.amountPaid,
    );

  const refundedAmount =
    decimalToNumber(
      bill.refundedAmount,
    );

  return {
    id: bill.id,

    billNumber:
      bill.billNumber,

    status:
      bill.status,

    paymentStatus:
      bill.paymentStatus,

    orderNumber:
      bill.order.orderNumber,

    grandTotal:
      decimalToNumber(
        bill.grandTotal,
      ),

    amountPaid,

    refundedAmount,

    refundableAmount:
      Math.max(
        0,
        Number(
          (
            amountPaid -
            refundedAmount
          ).toFixed(2),
        ),
      ),

    dueAmount:
      decimalToNumber(
        bill.dueAmount,
      ),

    inventoryStatus:
      bill.order
        .inventoryStatus,

    cancellationReason:
      bill.cancellationReason,

    cancelledAt:
      bill.cancelledAt
        ?.toISOString() ??
      null,

    refunds:
      bill.refunds.map(
        (refund) => ({
          id: refund.id,

          refundNumber:
            refund.refundNumber,

          amount:
            decimalToNumber(
              refund.amount,
            ),

          method:
            refund.method,

          reason:
            refund.reason,

          referenceNo:
            refund.referenceNo,

          notes:
            refund.notes,

          createdByName:
            refund.createdBy.name,

          createdAt:
            refund.createdAt.toISOString(),
        }),
      ),
  };
}