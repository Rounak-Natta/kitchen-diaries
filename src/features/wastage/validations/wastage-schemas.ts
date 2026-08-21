import { z } from "zod";

export const wastageReasonSchema =
  z.enum([
    "EXPIRED",
    "SPOILED",
    "DAMAGED",
    "PREPARATION_LOSS",
    "COOKING_LOSS",
    "ORDER_CANCELLED",
    "STAFF_MEAL",
    "SPILLAGE",
    "OTHER",
  ]);

export const wastageItemSchema =
  z
    .object({
      inventoryItemId: z
        .string()
        .trim()
        .min(
          1,
          "Inventory item is required.",
        ),

      quantity: z
        .number()
        .finite()
        .positive(
          "Wastage quantity must be greater than zero.",
        )
        .max(999_999_999),

      reason:
        wastageReasonSchema,

      notes: z
        .string()
        .trim()
        .max(500)
        .optional(),
    })
    .strict();

export const saveWastageDraftSchema =
  z
    .object({
      notes: z
        .string()
        .trim()
        .max(1_000)
        .optional(),

      items: z
        .array(
          wastageItemSchema,
        )
        .min(
          1,
          "At least one wastage item is required.",
        )
        .max(100),
    })
    .strict();

export const cancelWastageSchema =
  z
    .object({
      cancellationReason: z
        .string()
        .trim()
        .min(
          3,
          "Cancellation reason must contain at least 3 characters.",
        )
        .max(500),
    })
    .strict();

export type SaveWastageDraftInput =
  z.infer<
    typeof saveWastageDraftSchema
  >;

export type CancelWastageInput =
  z.infer<
    typeof cancelWastageSchema
  >;