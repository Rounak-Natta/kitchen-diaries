import { z } from "zod";

import {
  MAX_ORDER_ITEM_QUANTITY,
  MAX_ORDER_ITEMS,
} from "../constants";

const optionalText = (
  maximumLength: number,
) =>
  z
    .string()
    .trim()
    .max(maximumLength)
    .optional();

const orderItemSchema = z
  .object({
    menuItemId: z
      .string()
      .trim()
      .min(1)
      .max(100),

    quantity: z
      .number()
      .int()
      .min(1)
      .max(MAX_ORDER_ITEM_QUANTITY),

    variationOptionId: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),

    addonIds: z
      .array(
        z.string().trim().min(1).max(100),
      )
      .max(20)
      .default([]),

    notes: optionalText(500),
  })
  .strict()
  .superRefine((item, context) => {
    const uniqueAddonIds = new Set(
      item.addonIds,
    );

    if (
      uniqueAddonIds.size !==
      item.addonIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["addonIds"],
        message:
          "The same add-on cannot be selected twice.",
      });
    }
  });

export const createOrderSchema = z
  .object({
    idempotencyKey: z.string().uuid(),

    orderType: z.enum([
      "DINE_IN",
      "TAKEAWAY",
      "DELIVERY",
    ]),

    tableNumber: optionalText(30),

    notes: optionalText(500),

    items: z
      .array(orderItemSchema)
      .min(1, "Cart is empty.")
      .max(MAX_ORDER_ITEMS),
  })
  .strict();

export type CreateOrderInput = z.infer<
  typeof createOrderSchema
>;