import { z } from "zod";

export const cancelBillSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(
        3,
        "Cancellation reason must contain at least 3 characters.",
      )
      .max(500),
  })
  .strict();

export const refundBillSchema = z
  .object({
    idempotencyKey: z.string().uuid(),

    amount: z
      .number()
      .finite()
      .positive(
        "Refund amount must be greater than zero.",
      )
      .max(999_999_999),

    method: z.enum([
      "CASH",
      "CARD",
      "UPI",
      "WALLET",
      "BANK_TRANSFER",
    ]),

    reason: z
      .string()
      .trim()
      .min(
        3,
        "Refund reason must contain at least 3 characters.",
      )
      .max(500),

    referenceNo: z
      .string()
      .trim()
      .max(150)
      .optional(),

    notes: z
      .string()
      .trim()
      .max(500)
      .optional(),
  })
  .strict();

export type CancelBillInput = z.infer<
  typeof cancelBillSchema
>;

export type RefundBillInput = z.infer<
  typeof refundBillSchema
>;