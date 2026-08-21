import { z } from "zod";

const optionalText = (
  maximumLength: number,
) =>
  z
    .string()
    .trim()
    .max(maximumLength)
    .optional();

const customerNameSchema = z
  .string()
  .trim()
  .min(2, "Customer name is required.")
  .max(150, "Customer name is too long.");

const customerPhoneSchema = z
  .string()
  .trim()
  .min(7, "Customer phone number is required.")
  .max(30, "Customer phone number is too long.")
  .regex(
    /^\+?[0-9][0-9\s().-]{5,28}[0-9]$/,
    "Enter a valid customer phone number.",
  );

export const paymentMethodSchema =
  z.enum([
    "CASH",
    "CARD",
    "UPI",
    "WALLET",
    "BANK_TRANSFER",
  ]);

export const paymentInputSchema =
  z
    .object({
      idempotencyKey:
        z.string().uuid(),

      method:
        paymentMethodSchema,

      tenderedAmount: z
        .number()
        .finite()
        .positive()
        .max(99_999_999.99),

      referenceNo:
        optionalText(150),

      notes:
        optionalText(500),
    })
    .strict();

export const createBillSchema =
  z
    .object({
      idempotencyKey:
        z.string().uuid(),

      orderId: z
        .string()
        .trim()
        .min(1)
        .max(100),

      customerName:
        customerNameSchema,

      customerPhone:
        customerPhoneSchema,

      customerAddress:
        optionalText(500),

      notes:
        optionalText(500),

      payment:
        paymentInputSchema.optional(),
    })
    .strict();

export const addPaymentSchema =
  paymentInputSchema;

export type CreateBillInput =
  z.infer<
    typeof createBillSchema
  >;

export type AddPaymentInput =
  z.infer<
    typeof addPaymentSchema
  >;
