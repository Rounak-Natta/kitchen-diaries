import {
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  AddonRuleEditorDataDto,
  AddonRuleListItemDto,
  VariationRuleEditorDataDto,
  VariationRuleListItemDto,
} from "../types";

function decimalToNumber(
  value:
    | Prisma.Decimal
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

  const result =
    Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

async function getInventoryOptions(
  restaurantId: string,
) {
  return prisma.inventoryItem.findMany({
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
  });
}

export async function getVariationRecipeRuleList(
  restaurantId: string,
): Promise<VariationRuleListItemDto[]> {
  const groups =
    await prisma.variationGroup.findMany({
      where: {
        restaurantId,
        isActive: true,
        deletedAt: null,
      },

      select: {
        id: true,
        name: true,

        options: {
          where: {
            isActive: true,
            deletedAt: null,
          },

          select: {
            id: true,
            name: true,

            _count: {
              select: {
                recipeAdjustments:
                  true,
              },
            },
          },

          orderBy: [
            {
              sortOrder: "asc",
            },
            {
              name: "asc",
            },
          ],
        },
      },

      orderBy: {
        name: "asc",
      },
    });

  return groups.flatMap(
    (group) =>
      group.options.map(
        (option) => ({
          id: option.id,
          name: option.name,
          groupName:
            group.name,

          ruleCount:
            option._count
              .recipeAdjustments,
        }),
      ),
  );
}

export async function getAddonRecipeRuleList(
  restaurantId: string,
): Promise<AddonRuleListItemDto[]> {
  const addons =
    await prisma.addon.findMany({
      where: {
        restaurantId,
        isActive: true,
        deletedAt: null,
      },

      select: {
        id: true,
        name: true,
        price: true,

        _count: {
          select: {
            recipeItems: true,
          },
        },
      },

      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          name: "asc",
        },
      ],
    });

  return addons.map(
    (addon) => ({
      id: addon.id,
      name: addon.name,

      price:
        decimalToNumber(
          addon.price,
        ),

      ruleCount:
        addon._count
          .recipeItems,
    }),
  );
}

export async function getVariationRecipeRuleEditorData(
  restaurantId: string,
  variationOptionId: string,
): Promise<VariationRuleEditorDataDto | null> {
  const [
    variationOption,
    inventoryItems,
  ] = await Promise.all([
    prisma.variationOption.findFirst({
      where: {
        id:
          variationOptionId,

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
            id: true,
            adjustmentType: true,
            quantity: true,
            unit: true,
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
            createdAt: "asc",
          },
        },
      },
    }),

    getInventoryOptions(
      restaurantId,
    ),
  ]);

  if (!variationOption) {
    return null;
  }

  return {
    variationOption: {
      id:
        variationOption.id,

      name:
        variationOption.name,

      groupName:
        variationOption
          .variationGroup.name,
    },

    rules:
      variationOption
        .recipeAdjustments.map(
          (rule) => ({
            id: rule.id,

            inventoryItemId:
              rule.inventoryItem.id,

            inventoryItemName:
              rule.inventoryItem.name,

            inventoryItemCode:
              rule.inventoryItem.code,

            adjustmentType:
              rule.adjustmentType,

            quantity:
              decimalToNumber(
                rule.quantity,
              ),

            unit: rule.unit,

            notes:
              rule.notes,
          }),
        ),

    inventoryItems,
  };
}

export async function getAddonRecipeRuleEditorData(
  restaurantId: string,
  addonId: string,
): Promise<AddonRuleEditorDataDto | null> {
  const [
    addon,
    inventoryItems,
  ] = await Promise.all([
    prisma.addon.findFirst({
      where: {
        id: addonId,
        restaurantId,
        isActive: true,
        deletedAt: null,
      },

      select: {
        id: true,
        name: true,
        price: true,

        recipeItems: {
          select: {
            id: true,
            quantity: true,
            unit: true,
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
            createdAt: "asc",
          },
        },
      },
    }),

    getInventoryOptions(
      restaurantId,
    ),
  ]);

  if (!addon) {
    return null;
  }

  return {
    addon: {
      id: addon.id,
      name: addon.name,

      price:
        decimalToNumber(
          addon.price,
        ),
    },

    rules:
      addon.recipeItems.map(
        (rule) => ({
          id: rule.id,

          inventoryItemId:
            rule.inventoryItem.id,

          inventoryItemName:
            rule.inventoryItem.name,

          inventoryItemCode:
            rule.inventoryItem.code,

          quantity:
            decimalToNumber(
              rule.quantity,
            ),

          unit: rule.unit,

          notes:
            rule.notes,
        }),
      ),

    inventoryItems,
  };
}