import {
  Role,
} from "@prisma/client";
import { z } from "zod";

const roleSchema =
  z
    .enum([
      "OWNER",
      "MANAGER",
      "CASHIER",
      "STEWARD",
      "KITCHEN",
      "STORE_KEEPER",
    ])
    .transform(
      (value) =>
        value as Role,
    );

const nameSchema =
  z
    .string()
    .trim()
    .min(
      2,
      "Name must contain at least 2 characters.",
    )
    .max(
      100,
      "Name cannot exceed 100 characters.",
    );

const emailSchema =
  z
    .string()
    .trim()
    .email(
      "Enter a valid email address.",
    )
    .max(
      254,
      "Email cannot exceed 254 characters.",
    )
    .transform(
      (value) =>
        value.toLowerCase(),
    );

const passwordSchema =
  z
    .string()
    .min(
      10,
      "Password must contain at least 10 characters.",
    )
    .max(
      72,
      "Password cannot exceed 72 characters.",
    )
    .regex(
      /[A-Za-z]/,
      "Password must contain at least one letter.",
    )
    .regex(
      /\d/,
      "Password must contain at least one number.",
    );

export const createRestaurantUserSchema =
  z
    .object({
      name: nameSchema,
      email: emailSchema,
      role: roleSchema,
      password:
        passwordSchema,
      isActive:
        z.boolean(),
    })
    .strict();

export const updateRestaurantUserSchema =
  z
    .object({
      name: nameSchema,
      email: emailSchema,
      role: roleSchema,

      newPassword:
        passwordSchema
          .optional(),
    })
    .strict();

export const setRestaurantUserActiveSchema =
  z
    .object({
      isActive:
        z.boolean(),

      reason:
        z
          .string()
          .trim()
          .max(
            500,
            "Reason cannot exceed 500 characters.",
          )
          .optional(),
    })
    .strict()
    .superRefine(
      (value, context) => {
        if (
          !value.isActive &&
          (
            !value.reason ||
            value.reason.length < 3
          )
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              "reason",
            ],

            message:
              "A deactivation reason of at least 3 characters is required.",
          });
        }
      },
    );

export type CreateRestaurantUserInput =
  z.input<
    typeof createRestaurantUserSchema
  >;

export type UpdateRestaurantUserInput =
  z.input<
    typeof updateRestaurantUserSchema
  >;

export type SetRestaurantUserActiveInput =
  z.input<
    typeof setRestaurantUserActiveSchema
  >;