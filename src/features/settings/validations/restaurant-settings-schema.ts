import { z } from "zod";

const nullableTextSchema =
  z
    .string()
    .trim()
    .max(500)
    .transform(
      (value) =>
        value || null,
    );

const nullableEmailSchema =
  z
    .string()
    .trim()
    .max(254)
    .refine(
      (value) =>
        value === "" ||
        z
          .string()
          .email()
          .safeParse(
            value,
          )
          .success,

      "Enter a valid email address.",
    )
    .transform(
      (value) =>
        value
          ? value.toLowerCase()
          : null,
    );

export const restaurantSettingsSchema =
  z
    .object({
      name:
        z
          .string()
          .trim()
          .min(
            2,
            "Restaurant name must contain at least 2 characters.",
          )
          .max(
            150,
            "Restaurant name cannot exceed 150 characters.",
          ),

      email:
        nullableEmailSchema,

      phone:
        z
          .string()
          .trim()
          .max(
            30,
            "Phone number cannot exceed 30 characters.",
          )
          .transform(
            (value) =>
              value || null,
          ),

      address:
        nullableTextSchema,

      defaultTaxRate:
        z
          .number()
          .finite()
          .min(
            0,
            "Tax rate cannot be negative.",
          )
          .max(
            100,
            "Tax rate cannot exceed 100%.",
          ),
    })
    .strict();

export type RestaurantSettingsInput =
  z.input<
    typeof restaurantSettingsSchema
  >;