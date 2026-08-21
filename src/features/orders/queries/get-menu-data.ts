import {
  MenuItemStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  MenuDataDto,
} from "../types";

function decimalToNumber(
  value:
    | {
        toString(): string;
      }
    | number
    | string
    | null
    | undefined,
): number {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

export async function getMenuData(
  restaurantId: string,
): Promise<MenuDataDto> {
  if (!restaurantId.trim()) {
    throw new Error(
      "Restaurant ID is required.",
    );
  }

  const [menuItems, categories] =
    await Promise.all([
      prisma.menuItem.findMany({
        where: {
          restaurantId,
          isActive: true,
          status:
            MenuItemStatus.AVAILABLE,

          category: {
            isActive: true,
          },
        },

        select: {
          id: true,
          name: true,
          price: true,

          category: {
            select: {
              id: true,
              name: true,
            },
          },

          variations: {
            select: {
              variationGroup: {
                select: {
                  id: true,
                  name: true,

                  options: {
                    where: {
                      isActive: true,
                    },

                    select: {
                      id: true,
                      name: true,
                      price: true,
                      isDefault: true,
                    },

                    orderBy: {
                      sortOrder: "asc",
                    },
                  },
                },
              },
            },
          },

          addons: {
            where: {
              addon: {
                isActive: true,
              },
            },

            select: {
              addon: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
        },

        orderBy: [
          {
            category: {
              name: "asc",
            },
          },
          {
            sortOrder: "asc",
          },
          {
            name: "asc",
          },
        ],
      }),

      prisma.category.findMany({
        where: {
          restaurantId,
          isActive: true,
        },

        select: {
          id: true,
          name: true,
        },

        orderBy: {
          name: "asc",
        },
      }),
    ]);

  return {
    categories,

    menuItems: menuItems.map(
      (menuItem) => ({
        id: menuItem.id,
        name: menuItem.name,

        price: decimalToNumber(
          menuItem.price,
        ),

        category: {
          id: menuItem.category.id,
          name: menuItem.category.name,
        },

        variations:
          menuItem.variations.map(
            (variation) => ({
              variationGroup: {
                id:
                  variation
                    .variationGroup.id,

                name:
                  variation
                    .variationGroup.name,

                options:
                  variation.variationGroup.options.map(
                    (option) => ({
                      id: option.id,
                      name: option.name,

                      /*
                       * Handles Decimal | null.
                       */
                      price:
                        decimalToNumber(
                          option.price,
                        ),

                      isDefault:
                        option.isDefault,
                    }),
                  ),
              },
            }),
          ),

        addons:
          menuItem.addons.map(
            (link) => ({
              addon: {
                id: link.addon.id,
                name:
                  link.addon.name,

                /*
                 * Also safe if add-on price is nullable.
                 */
                price:
                  decimalToNumber(
                    link.addon.price,
                  ),
              },
            }),
          ),
      }),
    ),
  };
}