"use server";

import {
  InventoryTransactionType,
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
  postInventoryTransaction,
} from "../services/inventory-transaction-service";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  type CreateInventoryItemInput,
  type UpdateInventoryItemInput,
} from "../validations/inventory-item-schema";

export type InventoryItemActionResult =
  | {
      success: true;
      inventoryItemId: string;
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
    decimal.lt(0)
  ) {
    throw new Error(
      "Inventory quantity must be zero or greater.",
    );
  }

  return decimal.toDecimalPlaces(3);
}

function isUniqueConstraintError(
  error: unknown,
): boolean {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function validateCategory(
  transaction:
    Prisma.TransactionClient,
  restaurantId: string,
  categoryId:
    | string
    | undefined,
): Promise<string | null> {
  if (!categoryId) {
    return null;
  }

  const category =
    await transaction.inventoryCategory.findFirst({
      where: {
        id: categoryId,
        restaurantId,
        isActive: true,
        deletedAt: null,
      },

      select: {
        id: true,
      },
    });

  if (!category) {
    throw new Error(
      "The selected inventory category is invalid.",
    );
  }

  return category.id;
}

function safeInventoryItemError(
  error: unknown,
): string {
  if (!(error instanceof Error)) {
    return "The inventory item could not be saved.";
  }

  const safeMessages = [
    "selected inventory category",
    "inventory quantity",
    "unit cannot be changed",
    "inventory item was not found",
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
    : "The inventory item could not be saved.";
}

export async function createInventoryItem(
  data: CreateInventoryItemInput,
): Promise<InventoryItemActionResult> {
  const user =
    await getAuthUser();

  if (!user) {
    return {
      success: false,
      error: "Unauthorized.",
    };
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.INVENTORY_CREATE,
    )
  ) {
    return {
      success: false,
      error:
        "You do not have permission to create inventory items.",
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
    createInventoryItemSchema.safeParse(
      data,
    );

  if (!validation.success) {
    return {
      success: false,

      error:
        validation.error.issues[0]
          ?.message ??
        "Invalid inventory item.",
    };
  }

  const input =
    validation.data;

  const restaurantId =
    user.restaurantId;

  try {
    const item =
      await withSerializableTransaction(
        async (transaction) => {
          const categoryId =
            await validateCategory(
              transaction,
              restaurantId,
              input.categoryId,
            );

          const createdItem =
            await transaction.inventoryItem.create({
              data: {
                name:
                  input.name.trim(),

                code:
                  input.code
                    .trim()
                    .toUpperCase(),

                barcode:
                  normalizeOptionalText(
                    input.barcode,
                  ),

                description:
                  normalizeOptionalText(
                    input.description,
                  ),

                type:
                  input.type,

                unit:
                  input.unit,

                minimumStock:
                  toQuantity(
                    input.minimumStock,
                  ),

                reorderLevel:
                  toQuantity(
                    input.reorderLevel,
                  ),

                currentStock:
                  toQuantity(0),

                averageCost:
                  new Prisma.Decimal(
                    0,
                  ),

                allowNegativeStock:
                  input.allowNegativeStock,

                notes:
                  normalizeOptionalText(
                    input.notes,
                  ),

                categoryId,
                restaurantId,
                isActive: true,
              },

              select: {
                id: true,
                name: true,
                code: true,
              },
            });

          if (
            input.openingStock > 0
          ) {
            await postInventoryTransaction(
              transaction,
              {
                restaurantId,

                createdById:
                  user.id,

                inventoryItemId:
                  createdItem.id,

                type:
                  InventoryTransactionType.OPENING_STOCK,

                quantityChange:
                  input.openingStock,

                unitCost:
                  input.openingUnitCost ??
                  0,

                idempotencyKey:
                  input.idempotencyKey,

                reason:
                  "Opening stock entered during inventory item creation.",

                referenceType:
                  "INVENTORY_ITEM_CREATE",

                referenceId:
                  createdItem.id,
              },
            );
          }

          await writeAuditLog(
            transaction,
            {
              restaurantId,
              userId: user.id,

              module:
                "INVENTORY",

              action:
                "CREATE_ITEM",

              entityType:
                "InventoryItem",

              entityId:
                createdItem.id,

              newData: {
                name:
                  createdItem.name,

                code:
                  createdItem.code,

                type:
                  input.type,

                unit:
                  input.unit,

                categoryId,

                minimumStock:
                  input.minimumStock,

                reorderLevel:
                  input.reorderLevel,

                openingStock:
                  input.openingStock,

                openingUnitCost:
                  input.openingUnitCost ??
                  null,

                allowNegativeStock:
                  input.allowNegativeStock,
              },
            },
          );

          return createdItem;
        },
      );

    revalidatePath(
      "/inventory",
    );

    revalidatePath(
      "/inventory/transactions",
    );

    return {
      success: true,

      inventoryItemId:
        item.id,

      message:
        "Inventory item created successfully.",
    };
  } catch (error: unknown) {
    console.error(
      "CREATE_INVENTORY_ITEM_ERROR:",
      error,
    );

    if (
      isUniqueConstraintError(
        error,
      )
    ) {
      return {
        success: false,
        error:
          "An inventory item with this code or barcode already exists.",
      };
    }

    return {
      success: false,
      error:
        safeInventoryItemError(
          error,
        ),
    };
  }
}

export async function updateInventoryItem(
  inventoryItemId: string,
  data: UpdateInventoryItemInput,
): Promise<InventoryItemActionResult> {
  const user =
    await getAuthUser();

  if (!user) {
    return {
      success: false,
      error: "Unauthorized.",
    };
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.INVENTORY_UPDATE,
    )
  ) {
    return {
      success: false,
      error:
        "You do not have permission to update inventory items.",
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
    updateInventoryItemSchema.safeParse(
      data,
    );

  if (!validation.success) {
    return {
      success: false,

      error:
        validation.error.issues[0]
          ?.message ??
        "Invalid inventory item.",
    };
  }

  const input =
    validation.data;

  const restaurantId =
    user.restaurantId;

  try {
    const updatedItem =
      await withSerializableTransaction(
        async (transaction) => {
          const existingItem =
            await transaction.inventoryItem.findFirst({
              where: {
                id:
                  inventoryItemId,

                restaurantId,
                isActive: true,
                deletedAt: null,
              },

              select: {
                id: true,
                name: true,
                code: true,
                barcode: true,
                description: true,
                type: true,
                unit: true,
                minimumStock: true,
                reorderLevel: true,
                allowNegativeStock:
                  true,
                notes: true,
                categoryId: true,

                _count: {
                  select: {
                    transactions:
                      true,
                  },
                },
              },
            });

          if (!existingItem) {
            throw new Error(
              "Inventory item was not found.",
            );
          }

          if (
            existingItem.unit !==
              input.unit &&
            existingItem._count
              .transactions > 0
          ) {
            throw new Error(
              "The inventory unit cannot be changed after stock transactions exist.",
            );
          }

          const categoryId =
            await validateCategory(
              transaction,
              restaurantId,
              input.categoryId,
            );

          const item =
            await transaction.inventoryItem.update({
              where: {
                id:
                  existingItem.id,
              },

              data: {
                name:
                  input.name.trim(),

                code:
                  input.code
                    .trim()
                    .toUpperCase(),

                barcode:
                  normalizeOptionalText(
                    input.barcode,
                  ),

                description:
                  normalizeOptionalText(
                    input.description,
                  ),

                type:
                  input.type,

                unit:
                  input.unit,

                minimumStock:
                  toQuantity(
                    input.minimumStock,
                  ),

                reorderLevel:
                  toQuantity(
                    input.reorderLevel,
                  ),

                allowNegativeStock:
                  input.allowNegativeStock,

                notes:
                  normalizeOptionalText(
                    input.notes,
                  ),

                categoryId,
              },

              select: {
                id: true,
                name: true,
                code: true,
              },
            });

          await writeAuditLog(
            transaction,
            {
              restaurantId,
              userId:
                user.id,

              module:
                "INVENTORY",

              action:
                "UPDATE_ITEM",

              entityType:
                "InventoryItem",

              entityId:
                item.id,

              oldData: {
                name:
                  existingItem.name,

                code:
                  existingItem.code,

                barcode:
                  existingItem.barcode,

                description:
                  existingItem.description,

                type:
                  existingItem.type,

                unit:
                  existingItem.unit,

                minimumStock:
                  existingItem.minimumStock.toString(),

                reorderLevel:
                  existingItem.reorderLevel.toString(),

                allowNegativeStock:
                  existingItem.allowNegativeStock,

                notes:
                  existingItem.notes,

                categoryId:
                  existingItem.categoryId,
              },

              newData: {
                name:
                  input.name,

                code:
                  input.code,

                barcode:
                  normalizeOptionalText(
                    input.barcode,
                  ),

                description:
                  normalizeOptionalText(
                    input.description,
                  ),

                type:
                  input.type,

                unit:
                  input.unit,

                minimumStock:
                  input.minimumStock,

                reorderLevel:
                  input.reorderLevel,

                allowNegativeStock:
                  input.allowNegativeStock,

                notes:
                  normalizeOptionalText(
                    input.notes,
                  ),

                categoryId,
              },
            },
          );

          return item;
        },
      );

    revalidatePath(
      "/inventory",
    );

    revalidatePath(
      `/inventory/${inventoryItemId}/edit`,
    );

    return {
      success: true,

      inventoryItemId:
        updatedItem.id,

      message:
        "Inventory item updated successfully.",
    };
  } catch (error: unknown) {
    console.error(
      "UPDATE_INVENTORY_ITEM_ERROR:",
      error,
    );

    if (
      isUniqueConstraintError(
        error,
      )
    ) {
      return {
        success: false,
        error:
          "An inventory item with this code or barcode already exists.",
      };
    }

    return {
      success: false,

      error:
        safeInventoryItemError(
          error,
        ),
    };
  }
}