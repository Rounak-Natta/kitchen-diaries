"use server";

import {
  InventoryMode,
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
import { prisma } from "@/lib/prisma";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";
import {
  withSerializableTransaction,
} from "@/lib/transaction";

import {
  saveRecipeSchema,
  type SaveRecipeInput,
} from "../validations/save-recipe-schema";

export type SaveRecipeResult =
  | {
      success: true;
      recipeId: string;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

function normalizeOptionalText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    value?.trim();

  return normalized || null;
}

function toQuantity(
  value: number,
): Prisma.Decimal {
  const decimal =
    new Prisma.Decimal(value);

  if (
    !decimal.isFinite() ||
    decimal.lte(0)
  ) {
    throw new Error(
      "Ingredient quantity must be greater than zero.",
    );
  }

  return decimal.toDecimalPlaces(3);
}

function toPercentage(
  value: number,
): Prisma.Decimal {
  const decimal =
    new Prisma.Decimal(value);

  if (
    !decimal.isFinite() ||
    decimal.lt(0) ||
    decimal.gt(100)
  ) {
    throw new Error(
      "Wastage percentage must be between 0 and 100.",
    );
  }

  return decimal.toDecimalPlaces(2);
}

function safeRecipeError(
  error: unknown,
): string {
  if (!(error instanceof Error)) {
    return "The recipe could not be saved.";
  }

  const safeMessages = [
    "menu item was not found",
    "inventory item",
    "ingredient quantity",
    "wastage percentage",
  ];

  const isSafe =
    safeMessages.some(
      (message) =>
        error.message
          .toLowerCase()
          .includes(message),
    );

  return isSafe
    ? error.message
    : "The recipe could not be saved.";
}

export async function saveRecipe(
  data: SaveRecipeInput,
): Promise<SaveRecipeResult> {
  const user =
    await getAuthUser();

  if (!user) {
    return {
      success: false,
      error: "Unauthorized.",
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
    saveRecipeSchema.safeParse(data);

  if (!validation.success) {
    return {
      success: false,

      error:
        validation.error.issues[0]
          ?.message ??
        "Invalid recipe information.",
    };
  }

  const input =
    validation.data;

  const restaurantId =
    user.restaurantId;

  const existingRecipe =
    await prisma.recipe.findFirst({
      where: {
        menuItemId:
          input.menuItemId,

        restaurantId,
      },

      select: {
        id: true,
      },
    });

  const requiredPermission =
    existingRecipe
      ? PERMISSIONS.RECIPE_UPDATE
      : PERMISSIONS.RECIPE_CREATE;

  if (
    !hasPermission(
      user.role,
      requiredPermission,
    )
  ) {
    return {
      success: false,

      error:
        "You do not have permission to save this recipe.",
    };
  }

  try {
    const result =
      await withSerializableTransaction(
        async (transaction) => {
          const menuItem =
            await transaction.menuItem.findFirst({
              where: {
                id:
                  input.menuItemId,

                restaurantId,
                isActive: true,
                deletedAt: null,
              },

              select: {
                id: true,
                name: true,

                directInventoryItemId:
                  true,

                recipe: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    notes: true,
                    isActive: true,

                    items: {
                      select: {
                        inventoryItemId:
                          true,

                        quantity: true,
                        unit: true,

                        wastagePercent:
                          true,

                        notes: true,
                      },

                      orderBy: {
                        sortOrder:
                          "asc",
                      },
                    },
                  },
                },
              },
            });

          if (!menuItem) {
            throw new Error(
              "Menu item was not found for this restaurant.",
            );
          }

          const inventoryItemIds =
            Array.from(
              new Set(
                input.items.map(
                  (item) =>
                    item.inventoryItemId,
                ),
              ),
            );

          const inventoryItems =
            await transaction.inventoryItem.findMany({
              where: {
                id: {
                  in:
                    inventoryItemIds,
                },

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
            });

          if (
            inventoryItems.length !==
            inventoryItemIds.length
          ) {
            throw new Error(
              "One or more inventory items are invalid or inactive.",
            );
          }

          const inventoryItemById =
            new Map(
              inventoryItems.map(
                (item) => [
                  item.id,
                  item,
                ],
              ),
            );

          const recipe =
            await transaction.recipe.upsert({
              where: {
                menuItemId:
                  menuItem.id,
              },

              create: {
                menuItemId:
                  menuItem.id,

                restaurantId,

                name:
                  input.name,

                description:
                  normalizeOptionalText(
                    input.description,
                  ),

                notes:
                  normalizeOptionalText(
                    input.notes,
                  ),

                isActive:
                  input.isActive,
              },

              update: {
                name:
                  input.name,

                description:
                  normalizeOptionalText(
                    input.description,
                  ),

                notes:
                  normalizeOptionalText(
                    input.notes,
                  ),

                isActive:
                  input.isActive,

                deletedAt: null,
              },

              select: {
                id: true,
              },
            });

          await transaction.recipeItem.deleteMany({
            where: {
              recipeId:
                recipe.id,
            },
          });

          await transaction.recipeItem.createMany({
            data:
              input.items.map(
                (item, index) => {
                  const inventoryItem =
                    inventoryItemById.get(
                      item.inventoryItemId,
                    );

                  if (!inventoryItem) {
                    throw new Error(
                      "Inventory item was not found.",
                    );
                  }

                  return {
                    recipeId:
                      recipe.id,

                    inventoryItemId:
                      inventoryItem.id,

                    quantity:
                      toQuantity(
                        item.quantity,
                      ),

                    unit:
                      inventoryItem.unit,

                    wastagePercent:
                      toPercentage(
                        item.wastagePercent,
                      ),

                    sortOrder:
                      index,

                    notes:
                      normalizeOptionalText(
                        item.notes,
                      ),
                  };
                },
              ),
          });

          const inventoryMode =
            input.isActive
              ? InventoryMode.RECIPE
              : menuItem
                    .directInventoryItemId
                ? InventoryMode.DIRECT
                : InventoryMode.NONE;

          await transaction.menuItem.update({
            where: {
              id: menuItem.id,
            },

            data: {
              inventoryMode,
            },
          });

          await writeAuditLog(
            transaction,
            {
              restaurantId,
              userId: user.id,

              module: "RECIPES",

              action:
                menuItem.recipe
                  ? "UPDATE"
                  : "CREATE",

              entityType:
                "Recipe",

              entityId:
                recipe.id,

              oldData:
                menuItem.recipe
                  ? {
                      name:
                        menuItem
                          .recipe.name,

                      description:
                        menuItem
                          .recipe
                          .description,

                      notes:
                        menuItem
                          .recipe.notes,

                      isActive:
                        menuItem
                          .recipe
                          .isActive,

                      items:
                        menuItem
                          .recipe
                          .items,
                    }
                  : undefined,

              newData: {
                menuItemId:
                  menuItem.id,

                menuItemName:
                  menuItem.name,

                name:
                  input.name,

                description:
                  normalizeOptionalText(
                    input.description,
                  ),

                notes:
                  normalizeOptionalText(
                    input.notes,
                  ),

                isActive:
                  input.isActive,

                inventoryMode,

                items:
                  input.items.map(
                    (item, index) => {
                      const inventoryItem =
                        inventoryItemById.get(
                          item.inventoryItemId,
                        );

                      return {
                        inventoryItemId:
                          item.inventoryItemId,

                        inventoryItemName:
                          inventoryItem
                            ?.name,

                        quantity:
                          item.quantity,

                        unit:
                          inventoryItem
                            ?.unit,

                        wastagePercent:
                          item.wastagePercent,

                        sortOrder:
                          index,
                      };
                    },
                  ),
              },
            },
          );

          return recipe;
        },
      );

    revalidatePath(
      "/recipes",
    );

    revalidatePath(
      `/recipes/${input.menuItemId}`,
    );

    revalidatePath(
      "/menu",
    );

    return {
      success: true,

      recipeId:
        result.id,

      message:
        existingRecipe
          ? "Recipe updated successfully."
          : "Recipe created successfully.",
    };
  } catch (error: unknown) {
    console.error(
      "SAVE_RECIPE_ERROR:",
      error,
    );

    return {
      success: false,
      error:
        safeRecipeError(error),
    };
  }
}