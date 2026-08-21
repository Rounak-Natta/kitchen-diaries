"use server";

import {
  Prisma,
  RecipeAdjustmentType,
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
  saveAddonRecipeRulesSchema,
  saveVariationRecipeRulesSchema,
  type SaveAddonRecipeRulesInput,
  type SaveVariationRecipeRulesInput,
} from "../validations/recipe-rule-schemas";

export type SaveRecipeRulesResult =
  | {
      success: true;
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
  allowZero = false,
): Prisma.Decimal {
  const decimal =
    new Prisma.Decimal(value);

  if (
    !decimal.isFinite() ||
    decimal.lt(0) ||
    (!allowZero &&
      decimal.lte(0))
  ) {
    throw new Error(
      allowZero
        ? "Recipe quantity must be zero or greater."
        : "Recipe quantity must be greater than zero.",
    );
  }

  return decimal.toDecimalPlaces(3);
}

function safeRuleError(
  error: unknown,
): string {
  if (!(error instanceof Error)) {
    return "Recipe rules could not be saved.";
  }

  const safeMessages = [
    "variation option was not found",
    "add-on was not found",
    "inventory item",
    "recipe quantity",
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
    : "Recipe rules could not be saved.";
}

export async function saveVariationRecipeRules(
  data: SaveVariationRecipeRulesInput,
): Promise<SaveRecipeRulesResult> {
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

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.RECIPE_UPDATE,
    )
  ) {
    return {
      success: false,

      error:
        "You do not have permission to update variation recipe rules.",
    };
  }

  const validation =
    saveVariationRecipeRulesSchema.safeParse(
      data,
    );

  if (!validation.success) {
    return {
      success: false,

      error:
        validation.error.issues[0]
          ?.message ??
        "Invalid variation recipe rules.",
    };
  }

  const input =
    validation.data;

  const restaurantId =
    user.restaurantId;

  try {
    await withSerializableTransaction(
      async (transaction) => {
        const variationOption =
          await transaction.variationOption.findFirst({
            where: {
              id:
                input.variationOptionId,

              isActive: true,
              deletedAt: null,

              variationGroup: {
                restaurantId,
                isActive: true,
                deletedAt: null,
              },
            },

            select: {
              id: true,
              name: true,

              variationGroup: {
                select: {
                  name: true,
                },
              },

              recipeAdjustments: {
                select: {
                  inventoryItemId:
                    true,

                  adjustmentType:
                    true,

                  quantity: true,
                  unit: true,
                  notes: true,
                },
              },
            },
          });

        if (!variationOption) {
          throw new Error(
            "Variation option was not found for this restaurant.",
          );
        }

        const inventoryItemIds =
          Array.from(
            new Set(
              input.rules.map(
                (rule) =>
                  rule.inventoryItemId,
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

        await transaction.variationRecipeItem.deleteMany({
          where: {
            variationOptionId:
              variationOption.id,
          },
        });

        if (
          input.rules.length > 0
        ) {
          await transaction.variationRecipeItem.createMany({
            data:
              input.rules.map(
                (rule) => {
                  const inventoryItem =
                    inventoryItemById.get(
                      rule.inventoryItemId,
                    );

                  if (!inventoryItem) {
                    throw new Error(
                      "Inventory item was not found.",
                    );
                  }

                  const adjustmentType =
                    RecipeAdjustmentType[
                      rule.adjustmentType
                    ];

                  const isRemove =
                    adjustmentType ===
                    RecipeAdjustmentType.REMOVE;

                  return {
                    variationOptionId:
                      variationOption.id,

                    inventoryItemId:
                      inventoryItem.id,

                    adjustmentType,

                    quantity:
                      isRemove
                        ? toQuantity(
                            0,
                            true,
                          )
                        : toQuantity(
                            rule.quantity,
                          ),

                    unit:
                      inventoryItem.unit,

                    notes:
                      normalizeOptionalText(
                        rule.notes,
                      ),
                  };
                },
              ),
          });
        }

        await writeAuditLog(
          transaction,
          {
            restaurantId,
            userId:
              user.id,

            module:
              "RECIPES",

            action:
              "SAVE_VARIATION_RULES",

            entityType:
              "VariationOption",

            entityId:
              variationOption.id,

            oldData: {
              variationOptionName:
                variationOption.name,

              variationGroupName:
                variationOption
                  .variationGroup
                  .name,

              rules:
                variationOption
                  .recipeAdjustments,
            },

            newData: {
              variationOptionName:
                variationOption.name,

              variationGroupName:
                variationOption
                  .variationGroup
                  .name,

              rules:
                input.rules.map(
                  (rule) => {
                    const item =
                      inventoryItemById.get(
                        rule.inventoryItemId,
                      );

                    return {
                      inventoryItemId:
                        rule.inventoryItemId,

                      inventoryItemName:
                        item?.name,

                      adjustmentType:
                        rule.adjustmentType,

                      quantity:
                        rule.adjustmentType ===
                        "REMOVE"
                          ? 0
                          : rule.quantity,

                      unit:
                        item?.unit,

                      notes:
                        normalizeOptionalText(
                          rule.notes,
                        ),
                    };
                  },
                ),
            },
          },
        );
      },
    );

    revalidatePath(
      "/recipes/variations",
    );

    revalidatePath(
      `/recipes/variations/${input.variationOptionId}`,
    );

    return {
      success: true,

      message:
        "Variation recipe rules saved successfully.",
    };
  } catch (error: unknown) {
    console.error(
      "SAVE_VARIATION_RECIPE_RULES_ERROR:",
      error,
    );

    return {
      success: false,

      error:
        safeRuleError(error),
    };
  }
}

export async function saveAddonRecipeRules(
  data: SaveAddonRecipeRulesInput,
): Promise<SaveRecipeRulesResult> {
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

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.RECIPE_UPDATE,
    )
  ) {
    return {
      success: false,

      error:
        "You do not have permission to update add-on recipe rules.",
    };
  }

  const validation =
    saveAddonRecipeRulesSchema.safeParse(
      data,
    );

  if (!validation.success) {
    return {
      success: false,

      error:
        validation.error.issues[0]
          ?.message ??
        "Invalid add-on recipe rules.",
    };
  }

  const input =
    validation.data;

  const restaurantId =
    user.restaurantId;

  try {
    await withSerializableTransaction(
      async (transaction) => {
        const addon =
          await transaction.addon.findFirst({
            where: {
              id: input.addonId,
              restaurantId,
              isActive: true,
              deletedAt: null,
            },

            select: {
              id: true,
              name: true,

              recipeItems: {
                select: {
                  inventoryItemId:
                    true,

                  quantity: true,
                  unit: true,
                  notes: true,
                },
              },
            },
          });

        if (!addon) {
          throw new Error(
            "Add-on was not found for this restaurant.",
          );
        }

        const inventoryItemIds =
          Array.from(
            new Set(
              input.rules.map(
                (rule) =>
                  rule.inventoryItemId,
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

        await transaction.addonRecipeItem.deleteMany({
          where: {
            addonId:
              addon.id,
          },
        });

        if (
          input.rules.length > 0
        ) {
          await transaction.addonRecipeItem.createMany({
            data:
              input.rules.map(
                (rule) => {
                  const inventoryItem =
                    inventoryItemById.get(
                      rule.inventoryItemId,
                    );

                  if (!inventoryItem) {
                    throw new Error(
                      "Inventory item was not found.",
                    );
                  }

                  return {
                    addonId:
                      addon.id,

                    inventoryItemId:
                      inventoryItem.id,

                    quantity:
                      toQuantity(
                        rule.quantity,
                      ),

                    unit:
                      inventoryItem.unit,

                    notes:
                      normalizeOptionalText(
                        rule.notes,
                      ),
                  };
                },
              ),
          });
        }

        await writeAuditLog(
          transaction,
          {
            restaurantId,
            userId:
              user.id,

            module:
              "RECIPES",

            action:
              "SAVE_ADDON_RULES",

            entityType:
              "Addon",

            entityId:
              addon.id,

            oldData: {
              addonName:
                addon.name,

              rules:
                addon.recipeItems,
            },

            newData: {
              addonName:
                addon.name,

              rules:
                input.rules.map(
                  (rule) => {
                    const item =
                      inventoryItemById.get(
                        rule.inventoryItemId,
                      );

                    return {
                      inventoryItemId:
                        rule.inventoryItemId,

                      inventoryItemName:
                        item?.name,

                      quantity:
                        rule.quantity,

                      unit:
                        item?.unit,

                      notes:
                        normalizeOptionalText(
                          rule.notes,
                        ),
                    };
                  },
                ),
            },
          },
        );
      },
    );

    revalidatePath(
      "/recipes/addons",
    );

    revalidatePath(
      `/recipes/addons/${input.addonId}`,
    );

    return {
      success: true,

      message:
        "Add-on recipe rules saved successfully.",
    };
  } catch (error: unknown) {
    console.error(
      "SAVE_ADDON_RECIPE_RULES_ERROR:",
      error,
    );

    return {
      success: false,

      error:
        safeRuleError(error),
    };
  }
}