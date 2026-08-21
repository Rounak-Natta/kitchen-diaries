import {
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  RecipeEditorDataDto,
  RecipeListItemDto,
} from "../types";

function decimalToNumber(
  value:
    | Prisma.Decimal
    | string
    | number
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

export async function getRecipeList(
  restaurantId: string,
): Promise<RecipeListItemDto[]> {
  const menuItems =
    await prisma.menuItem.findMany({
      where: {
        restaurantId,
        isActive: true,
        deletedAt: null,
      },

      select: {
        id: true,
        name: true,
        inventoryMode: true,

        category: {
          select: {
            name: true,
          },
        },

        recipe: {
          select: {
            id: true,
            isActive: true,
            updatedAt: true,

            _count: {
              select: {
                items: true,
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
          name: "asc",
        },
      ],
    });

  return menuItems.map(
    (menuItem) => ({
      menuItemId:
        menuItem.id,

      menuItemName:
        menuItem.name,

      categoryName:
        menuItem.category.name,

      inventoryMode:
        menuItem.inventoryMode,

      recipe:
        menuItem.recipe
          ? {
              id:
                menuItem.recipe.id,

              isActive:
                menuItem.recipe
                  .isActive,

              ingredientCount:
                menuItem.recipe
                  ._count.items,

              updatedAt:
                menuItem.recipe
                  .updatedAt
                  .toISOString(),
            }
          : null,
    }),
  );
}

export async function getRecipeEditorData(
  restaurantId: string,
  menuItemId: string,
): Promise<RecipeEditorDataDto | null> {
  const [menuItem, inventoryItems] =
    await Promise.all([
      prisma.menuItem.findFirst({
        where: {
          id: menuItemId,
          restaurantId,
          isActive: true,
          deletedAt: null,
        },

        select: {
          id: true,
          name: true,
          inventoryMode: true,

          category: {
            select: {
              name: true,
            },
          },

          recipe: {
            select: {
              id: true,
              name: true,
              description: true,
              notes: true,
              isActive: true,

              items: {
                select: {
                  id: true,
                  quantity: true,
                  unit: true,
                  wastagePercent: true,
                  notes: true,

                  inventoryItem: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
                },

                orderBy: {
                  sortOrder: "asc",
                },
              },
            },
          },
        },
      }),

      prisma.inventoryItem.findMany({
        where: {
          restaurantId,
          isActive: true,
          deletedAt: null,
        },

        select: {
          id: true,
          name: true,
          code: true,
          unit: true,
        },

        orderBy: {
          name: "asc",
        },
      }),
    ]);

  if (!menuItem) {
    return null;
  }

  return {
    menuItem: {
      id: menuItem.id,
      name: menuItem.name,

      categoryName:
        menuItem.category.name,

      inventoryMode:
        menuItem.inventoryMode,
    },

    recipe:
      menuItem.recipe
        ? {
            id:
              menuItem.recipe.id,

            name:
              menuItem.recipe.name,

            description:
              menuItem.recipe
                .description,

            notes:
              menuItem.recipe.notes,

            isActive:
              menuItem.recipe
                .isActive,

            items:
              menuItem.recipe.items.map(
                (item) => ({
                  id: item.id,

                  inventoryItemId:
                    item.inventoryItem.id,

                  inventoryItemName:
                    item.inventoryItem.name,

                  inventoryItemCode:
                    item.inventoryItem.code,

                  quantity:
                    decimalToNumber(
                      item.quantity,
                    ),

                  unit:
                    item.unit,

                  wastagePercent:
                    decimalToNumber(
                      item.wastagePercent,
                    ),

                  notes:
                    item.notes,
                }),
              ),
          }
        : null,

    inventoryItems:
      inventoryItems.map(
        (item) => ({
          id: item.id,
          name: item.name,
          code: item.code,
          unit: item.unit,
        }),
      ),
  };
}