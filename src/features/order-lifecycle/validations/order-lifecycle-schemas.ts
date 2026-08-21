import { z } from "zod";

export const updateOrderLifecycleSchema =
  z
    .object({
      expectedVersion:
        z
          .number()
          .int()
          .positive(),

      targetStatus:
        z.enum([
          "CONFIRMED",
          "PREPARING",
          "READY",
        ]),
    })
    .strict();

export const cancelOrderSchema =
  z
    .object({
      expectedVersion:
        z
          .number()
          .int()
          .positive(),

      reason:
        z
          .string()
          .trim()
          .min(
            3,
            "Cancellation reason must contain at least 3 characters.",
          )
          .max(
            500,
            "Cancellation reason cannot exceed 500 characters.",
          ),
    })
    .strict();

export const reconcileOrderSchema =
  z
    .object({
      expectedVersion:
        z
          .number()
          .int()
          .positive(),
    })
    .strict();

export type UpdateOrderLifecycleInput =
  z.infer<
    typeof updateOrderLifecycleSchema
  >;

export type CancelOrderInput =
  z.infer<
    typeof cancelOrderSchema
  >;

export type ReconcileOrderInput =
  z.infer<
    typeof reconcileOrderSchema
  >;