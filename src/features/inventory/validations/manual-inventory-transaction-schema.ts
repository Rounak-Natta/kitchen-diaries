import { z } from "zod";

export const manualInventoryTransactionTypeSchema =
  z.enum([
    "STOCK_IN",
    "STOCK_OUT",
    "ADJUSTMENT_IN",
    "ADJUSTMENT_OUT",
  ]);

export const manualInventoryTransactionSchema =
  z
    .object({
      idempotencyKey:
        z.string().uuid(),

      inventoryItemId: z
        .string()
        .trim()
        .min(1),

      type:
        manualInventoryTransactionTypeSchema,

      quantity: z
        .number()
        .finite()
        .positive()
        .max(999_999_999),

      unitCost: z
        .number()
        .finite()
        .min(0)
        .max(999_999_999)
        .optional(),

      reason: z
        .string()
        .trim()
        .max(500)
        .optional(),
    })
    .strict()
    .superRefine(
      (data, context) => {
        const requiresReason =
          data.type ===
            "ADJUSTMENT_IN" ||
          data.type ===
            "ADJUSTMENT_OUT";

        if (
          requiresReason &&
          !data.reason?.trim()
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,
            path: ["reason"],
            message:
              "A reason is required for stock adjustments.",
          });
        }
      },
    );

export type ManualInventoryTransactionInput =
  z.infer<
    typeof manualInventoryTransactionSchema
  >;