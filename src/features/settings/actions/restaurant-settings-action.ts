"use server";

import {
  Prisma,
} from "@prisma/client";
import {
  revalidatePath,
} from "next/cache";

import {
  writeAuditLog,
} from "@/lib/audit-log";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";
import {
  withSerializableTransaction,
} from "@/lib/transaction";

import {
  restaurantSettingsSchema,
  type RestaurantSettingsInput,
} from "../validations/restaurant-settings-schema";

export type RestaurantSettingsActionResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

function isUniqueConstraintError(
  error: unknown,
): boolean {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function updateRestaurantSettings(
  data: RestaurantSettingsInput,
): Promise<RestaurantSettingsActionResult> {
  const user =
    await getAuthUser();

  if (!user) {
    return {
      success: false,
      error:
        "Unauthorized.",
    };
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.SETTINGS_UPDATE,
    )
  ) {
    return {
      success: false,

      error:
        "You do not have permission to update restaurant settings.",
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
    restaurantSettingsSchema.safeParse(
      data,
    );

  if (!validation.success) {
    return {
      success: false,

      error:
        validation.error.issues[0]
          ?.message ??
        "Invalid restaurant settings.",
    };
  }

  const input =
    validation.data;

  try {
    await withSerializableTransaction(
      async (transaction) => {
        const existing =
          await transaction.restaurant.findUnique({
            where: {
              id: user.restaurantId,
            },

            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              currency: true,
              timezone: true,

              businessDayStartHour:
                true,

              defaultTaxRate:
                true,
            },
          });

        if (!existing) {
          throw new Error(
            "Restaurant was not found.",
          );
        }

        /*
         * Currency, timezone and business-day start
         * remain locked for v1 because core billing,
         * reporting and document numbering rely on:
         *
         * INR
         * Asia/Kolkata
         * 04:00 business-day start
         */
        const updated =
          await transaction.restaurant.update({
            where: {
              id: existing.id,
            },

            data: {
              name: input.name,
              email: input.email,
              phone: input.phone,
              address:
                input.address,

              defaultTaxRate:
                new Prisma.Decimal(
                  input.defaultTaxRate,
                ).toDecimalPlaces(
                  2,
                ),
            },

            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              currency: true,
              timezone: true,

              businessDayStartHour:
                true,

              defaultTaxRate:
                true,
            },
          });

        await writeAuditLog(
          transaction,
          {
            restaurantId:
              user.restaurantId,

            userId:
              user.id,

            module:
              "SETTINGS",

            action:
              "UPDATE_RESTAURANT_SETTINGS",

            entityType:
              "Restaurant",

            entityId:
              updated.id,

            oldData: {
              name:
                existing.name,

              email:
                existing.email,

              phone:
                existing.phone,

              address:
                existing.address,

              currency:
                existing.currency,

              timezone:
                existing.timezone,

              businessDayStartHour:
                existing.businessDayStartHour,

              defaultTaxRate:
                existing.defaultTaxRate.toString(),
            },

            newData: {
              name:
                updated.name,

              email:
                updated.email,

              phone:
                updated.phone,

              address:
                updated.address,

              currency:
                updated.currency,

              timezone:
                updated.timezone,

              businessDayStartHour:
                updated.businessDayStartHour,

              defaultTaxRate:
                updated.defaultTaxRate.toString(),
            },
          },
        );
      },
    );

    revalidatePath(
      "/settings/restaurant",
    );

    revalidatePath(
      "/billing",
    );

    revalidatePath(
      "/orders",
    );

    return {
      success: true,

      message:
        "Restaurant settings updated successfully.",
    };
  } catch (error: unknown) {
    if (
      isUniqueConstraintError(
        error,
      )
    ) {
      return {
        success: false,

        error:
          "This restaurant email address is already in use.",
      };
    }

    console.error(
      "UPDATE_RESTAURANT_SETTINGS_ERROR:",
      error,
    );

    return {
      success: false,

      error:
        error instanceof Error &&
        error.message ===
          "Restaurant was not found."
          ? error.message
          : "Restaurant settings could not be updated.",
    };
  }
}