import type {
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  RestaurantSettingsDto,
} from "../types";

function decimalToNumber(
  value:
    | Prisma.Decimal
    | string
    | number,
): number {
  const number =
    Number(value);

  return Number.isFinite(
    number,
  )
    ? number
    : 0;
}

export async function getRestaurantSettings(
  restaurantId: string,
): Promise<
  RestaurantSettingsDto | null
> {
  const restaurant =
    await prisma.restaurant.findUnique({
      where: {
        id: restaurantId,
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

        orderPrefix: true,
        billPrefix: true,
        receiptPrefix: true,

        isActive: true,
        updatedAt: true,
      },
    });

  if (!restaurant) {
    return null;
  }

  return {
    id: restaurant.id,
    name: restaurant.name,
    email: restaurant.email,
    phone: restaurant.phone,
    address:
      restaurant.address,

    currency:
      restaurant.currency,

    timezone:
      restaurant.timezone,

    businessDayStartHour:
      restaurant.businessDayStartHour,

    defaultTaxRate:
      decimalToNumber(
        restaurant.defaultTaxRate,
      ),

    orderPrefix:
      restaurant.orderPrefix,

    billPrefix:
      restaurant.billPrefix,

    receiptPrefix:
      restaurant.receiptPrefix,

    isActive:
      restaurant.isActive,

    updatedAt:
      restaurant.updatedAt.toISOString(),
  };
}