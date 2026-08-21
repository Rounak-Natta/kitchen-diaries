"use server";

import {
  DocumentType,
  InventoryTransactionType,
  Prisma,
  WastageStatus,
} from "@prisma/client";
import {
  revalidatePath,
} from "next/cache";

import {
  postInventoryTransaction,
} from "@/features/inventory/services/inventory-transaction-service";
import {
  writeAuditLog,
} from "@/lib/audit-log";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  getBusinessDate,
} from "@/lib/business-date";
import {
  nextDocumentNumber,
} from "@/lib/document-number";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";
import {
  withSerializableTransaction,
} from "@/lib/transaction";

import {
  cancelWastageSchema,
  saveWastageDraftSchema,
  type CancelWastageInput,
  type SaveWastageDraftInput,
} from "../validations/wastage-schemas";

export type SaveWastageResult =
  | {
      success: true;
      wastageId: string;
      wastageNumber: string;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

export type WastageStatusActionResult =
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
  value:
    | number
    | string
    | Prisma.Decimal,
): Prisma.Decimal {
  const decimal =
    new Prisma.Decimal(value);

  if (
    !decimal.isFinite() ||
    decimal.lte(0)
  ) {
    throw new Error(
      "Wastage quantity must be greater than zero.",
    );
  }

  return decimal.toDecimalPlaces(3);
}

function safeWastageError(
  error: unknown,
): string {
  if (!(error instanceof Error)) {
    return "The wastage operation could not be completed.";
  }

  const safeMessages = [
    "wastage was not found",
    "wastage draft",
    "already posted",
    "already cancelled",
    "cannot be edited",
    "cannot be posted",
    "cannot be cancelled",
    "inventory item",
    "insufficient stock",
    "wastage quantity",
    "inventory transaction",
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
    : "The wastage operation could not be completed.";
}

export async function saveWastageDraft(
  wastageId:
    | string
    | null,
  data: SaveWastageDraftInput,
): Promise<SaveWastageResult> {
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
      PERMISSIONS.WASTAGE_CREATE,
    )
  ) {
    return {
      success: false,

      error:
        "You do not have permission to create wastage drafts.",
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
    saveWastageDraftSchema.safeParse(
      data,
    );

  if (!validation.success) {
    return {
      success: false,

      error:
        validation.error.issues[0]
          ?.message ??
        "Invalid wastage information.",
    };
  }

  const input =
    validation.data;

  const restaurantId =
    user.restaurantId;

  const createdAt =
    new Date();

  try {
    const result =
      await withSerializableTransaction(
        async (transaction) => {
          const existingWastage =
            wastageId
              ? await transaction.wastage.findFirst({
                  where: {
                    id: wastageId,
                    restaurantId,
                  },

                  select: {
                    id: true,
                    wastageNumber:
                      true,
                    status: true,
                    businessDate:
                      true,
                    notes: true,

                    items: {
                      select: {
                        inventoryItemId:
                          true,
                        quantity: true,
                        reason: true,
                        notes: true,
                      },
                    },
                  },
                })
              : null;

          if (
            wastageId &&
            !existingWastage
          ) {
            throw new Error(
              "Wastage draft was not found.",
            );
          }

          if (
            existingWastage &&
            existingWastage.status !==
              WastageStatus.DRAFT
          ) {
            throw new Error(
              "This wastage cannot be edited because it is no longer a draft.",
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
                averageCost: true,
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

          const preparedItems =
            input.items.map(
              (item) => {
                const inventoryItem =
                  inventoryItemById.get(
                    item.inventoryItemId,
                  );

                if (!inventoryItem) {
                  throw new Error(
                    "Inventory item was not found.",
                  );
                }

                const quantity =
                  toQuantity(
                    item.quantity,
                  );

                const unitCost =
                  inventoryItem.averageCost
                    .toDecimalPlaces(4);

                const totalCost =
                  quantity
                    .mul(unitCost)
                    .toDecimalPlaces(2);

                return {
                  inventoryItemId:
                    inventoryItem.id,

                  quantity,

                  unit:
                    inventoryItem.unit,

                  unitCost,
                  totalCost,

                  reason:
                    item.reason,

                  notes:
                    normalizeOptionalText(
                      item.notes,
                    ),
                };
              },
            );

          const totalCost =
            preparedItems.reduce(
              (sum, item) =>
                sum.plus(
                  item.totalCost,
                ),

              new Prisma.Decimal(0),
            ).toDecimalPlaces(2);

          if (existingWastage) {
            await transaction.wastageItem.deleteMany({
              where: {
                wastageId:
                  existingWastage.id,
              },
            });

            await transaction.wastageItem.createMany({
              data:
                preparedItems.map(
                  (item) => ({
                    wastageId:
                      existingWastage.id,

                    ...item,
                  }),
                ),
            });

            const updated =
              await transaction.wastage.update({
                where: {
                  id:
                    existingWastage.id,
                },

                data: {
                  notes:
                    normalizeOptionalText(
                      input.notes,
                    ),

                  totalCost,
                },

                select: {
                  id: true,
                  wastageNumber:
                    true,
                },
              });

            await writeAuditLog(
              transaction,
              {
                restaurantId,
                userId: user.id,

                module:
                  "WASTAGE",

                action:
                  "UPDATE_DRAFT",

                entityType:
                  "Wastage",

                entityId:
                  updated.id,

                oldData: {
                  notes:
                    existingWastage.notes,

                  items:
                    existingWastage.items,
                },

                newData: {
                  notes:
                    normalizeOptionalText(
                      input.notes,
                    ),

                  totalCost:
                    totalCost.toString(),

                  items:
                    preparedItems,
                },
              },
            );

            return updated;
          }

          const businessDate =
            getBusinessDate(
              createdAt,
            );

          const wastageNumber =
            await nextDocumentNumber(
              transaction,
              {
                restaurantId,

                documentType:
                  DocumentType.WASTAGE,

                businessDate,
              },
            );

          const created =
            await transaction.wastage.create({
              data: {
                wastageNumber,

                status:
                  WastageStatus.DRAFT,

                businessDate,

                totalCost,

                notes:
                  normalizeOptionalText(
                    input.notes,
                  ),

                restaurantId,

                createdById:
                  user.id,

                createdAt,

                items: {
                  create:
                    preparedItems,
                },
              },

              select: {
                id: true,
                wastageNumber:
                  true,
              },
            });

          await writeAuditLog(
            transaction,
            {
              restaurantId,
              userId: user.id,

              module:
                "WASTAGE",

              action:
                "CREATE_DRAFT",

              entityType:
                "Wastage",

              entityId:
                created.id,

              newData: {
                wastageNumber:
                  created.wastageNumber,

                totalCost:
                  totalCost.toString(),

                notes:
                  normalizeOptionalText(
                    input.notes,
                  ),

                items:
                  preparedItems,
              },
            },
          );

          return created;
        },
      );

    revalidatePath(
      "/wastage",
    );

    revalidatePath(
      `/wastage/${result.id}`,
    );

    return {
      success: true,

      wastageId:
        result.id,

      wastageNumber:
        result.wastageNumber,

      message:
        wastageId
          ? "Wastage draft updated successfully."
          : "Wastage draft created successfully.",
    };
  } catch (error: unknown) {
    console.error(
      "SAVE_WASTAGE_DRAFT_ERROR:",
      error,
    );

    return {
      success: false,
      error:
        safeWastageError(
          error,
        ),
    };
  }
}

export async function postWastage(
  wastageId: string,
): Promise<WastageStatusActionResult> {
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
      PERMISSIONS.WASTAGE_POST,
    )
  ) {
    return {
      success: false,

      error:
        "You do not have permission to post wastage.",
    };
  }

  if (!user.restaurantId) {
    return {
      success: false,

      error:
        "No restaurant is assigned to this user.",
    };
  }

  const restaurantId =
    user.restaurantId;

  const postedAt =
    new Date();

  try {
    await withSerializableTransaction(
      async (transaction) => {
        const wastage =
          await transaction.wastage.findFirst({
            where: {
              id: wastageId,
              restaurantId,
            },

            select: {
              id: true,
              wastageNumber: true,
              status: true,
              businessDate: true,

              items: {
                select: {
                  id: true,
                  inventoryItemId:
                    true,
                  quantity: true,
                  reason: true,
                  notes: true,

                  inventoryItem: {
                    select: {
                      name: true,
                    },
                  },
                },

                orderBy: {
                  createdAt:
                    "asc",
                },
              },
            },
          });

        if (!wastage) {
          throw new Error(
            "Wastage was not found.",
          );
        }

        if (
          wastage.status ===
          WastageStatus.POSTED
        ) {
          throw new Error(
            "Wastage is already posted.",
          );
        }

        if (
          wastage.status ===
          WastageStatus.CANCELLED
        ) {
          throw new Error(
            "Cancelled wastage cannot be posted.",
          );
        }

        if (
          wastage.items.length === 0
        ) {
          throw new Error(
            "Wastage cannot be posted without items.",
          );
        }

        const businessDate =
          wastage.businessDate ??
          getBusinessDate(
            postedAt,
          );

        let totalCost =
          new Prisma.Decimal(0);

        const postedItems:
          Array<{
            wastageItemId: string;
            inventoryItemId: string;
            inventoryItemName: string;
            quantity: string;
            transactionNumber: string;
            totalCost: string;
          }> = [];

        for (
          const item of
          wastage.items
        ) {
          const inventoryTransaction =
            await postInventoryTransaction(
              transaction,
              {
                restaurantId,

                createdById:
                  user.id,

                inventoryItemId:
                  item.inventoryItemId,

                type:
                  InventoryTransactionType.WASTAGE,

                quantityChange:
                  item.quantity
                    .negated(),

                idempotencyKey:
                  `wastage:${wastage.id}:item:${item.id}:post`,

                reason:
                  `Wastage ${wastage.wastageNumber}: ${item.reason}`,

                referenceType:
                  "WASTAGE",

                referenceId:
                  wastage.id,

                businessDate,
              },
            );

          await transaction.wastageItem.update({
            where: {
              id: item.id,
            },

            data: {
              inventoryTransactionId:
                inventoryTransaction.id,

              unitCost:
                inventoryTransaction.unitCost,

              totalCost:
                inventoryTransaction.totalCost,
            },
          });

          totalCost =
            totalCost
              .plus(
                inventoryTransaction.totalCost,
              )
              .toDecimalPlaces(2);

          postedItems.push({
            wastageItemId:
              item.id,

            inventoryItemId:
              item.inventoryItemId,

            inventoryItemName:
              item.inventoryItem.name,

            quantity:
              item.quantity.toString(),

            transactionNumber:
              inventoryTransaction.transactionNumber,

            totalCost:
              inventoryTransaction.totalCost.toString(),
          });
        }

        await transaction.wastage.update({
          where: {
            id: wastage.id,
          },

          data: {
            status:
              WastageStatus.POSTED,

            totalCost,

            businessDate,

            postedAt,

            approvedById:
              user.id,
          },
        });

        await writeAuditLog(
          transaction,
          {
            restaurantId,
            userId: user.id,

            module:
              "WASTAGE",

            action:
              "POST",

            entityType:
              "Wastage",

            entityId:
              wastage.id,

            oldData: {
              status:
                WastageStatus.DRAFT,
            },

            newData: {
              status:
                WastageStatus.POSTED,

              wastageNumber:
                wastage.wastageNumber,

              totalCost:
                totalCost.toString(),

              postedAt:
                postedAt.toISOString(),

              items:
                postedItems,
            },
          },
        );
      },
    );

    revalidatePath(
      "/wastage",
    );

    revalidatePath(
      `/wastage/${wastageId}`,
    );

    revalidatePath(
      "/inventory",
    );

    revalidatePath(
      "/inventory/transactions",
    );

    return {
      success: true,
      message:
        "Wastage posted and inventory deducted successfully.",
    };
  } catch (error: unknown) {
    console.error(
      "POST_WASTAGE_ERROR:",
      error,
    );

    return {
      success: false,

      error:
        safeWastageError(
          error,
        ),
    };
  }
}

export async function cancelWastage(
  wastageId: string,
  data: CancelWastageInput,
): Promise<WastageStatusActionResult> {
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
      PERMISSIONS.WASTAGE_CANCEL,
    )
  ) {
    return {
      success: false,

      error:
        "You do not have permission to cancel wastage.",
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
    cancelWastageSchema.safeParse(
      data,
    );

  if (!validation.success) {
    return {
      success: false,

      error:
        validation.error.issues[0]
          ?.message ??
        "Invalid cancellation reason.",
    };
  }

  const input =
    validation.data;

  const restaurantId =
    user.restaurantId;

  const cancelledAt =
    new Date();

  try {
    await withSerializableTransaction(
      async (transaction) => {
        const wastage =
          await transaction.wastage.findFirst({
            where: {
              id: wastageId,
              restaurantId,
            },

            select: {
              id: true,
              wastageNumber: true,
              status: true,
              businessDate: true,
              totalCost: true,

              items: {
                select: {
                  id: true,
                  inventoryItemId:
                    true,
                  quantity: true,
                  unitCost: true,

                  inventoryItem: {
                    select: {
                      name: true,
                    },
                  },

                  inventoryTransaction: {
                    select: {
                      id: true,
                      transactionNumber:
                        true,
                    },
                  },
                },
              },
            },
          });

        if (!wastage) {
          throw new Error(
            "Wastage was not found.",
          );
        }

        if (
          wastage.status ===
          WastageStatus.CANCELLED
        ) {
          throw new Error(
            "Wastage is already cancelled.",
          );
        }

        const restoredItems:
          Array<{
            inventoryItemId: string;
            inventoryItemName: string;
            quantity: string;
            transactionNumber: string;
          }> = [];

        if (
          wastage.status ===
          WastageStatus.POSTED
        ) {
          for (
            const item of
            wastage.items
          ) {
            if (
              !item.inventoryTransaction
            ) {
              throw new Error(
                `Inventory transaction was not found for wastage item ${item.id}.`,
              );
            }

            const restoreTransaction =
              await postInventoryTransaction(
                transaction,
                {
                  restaurantId,

                  createdById:
                    user.id,

                  inventoryItemId:
                    item.inventoryItemId,

                  type:
                    InventoryTransactionType.RESTORE,

                  quantityChange:
                    item.quantity,

                  unitCost:
                    item.unitCost,

                  idempotencyKey:
                    `wastage:${wastage.id}:item:${item.id}:cancel`,

                  reason:
                    `Restore inventory after cancelling wastage ${wastage.wastageNumber}`,

                  referenceType:
                    "WASTAGE_CANCEL",

                  referenceId:
                    wastage.id,

                  businessDate:
                    wastage.businessDate ??
                    getBusinessDate(
                      cancelledAt,
                    ),
                },
              );

            restoredItems.push({
              inventoryItemId:
                item.inventoryItemId,

              inventoryItemName:
                item.inventoryItem.name,

              quantity:
                item.quantity.toString(),

              transactionNumber:
                restoreTransaction.transactionNumber,
            });
          }
        }

        await transaction.wastage.update({
          where: {
            id: wastage.id,
          },

          data: {
            status:
              WastageStatus.CANCELLED,

            cancelledAt,

            cancellationReason:
              input.cancellationReason,
          },
        });

        await writeAuditLog(
          transaction,
          {
            restaurantId,
            userId: user.id,

            module:
              "WASTAGE",

            action:
              "CANCEL",

            entityType:
              "Wastage",

            entityId:
              wastage.id,

            oldData: {
              status:
                wastage.status,

              totalCost:
                wastage.totalCost.toString(),
            },

            newData: {
              status:
                WastageStatus.CANCELLED,

              wastageNumber:
                wastage.wastageNumber,

              cancellationReason:
                input.cancellationReason,

              cancelledAt:
                cancelledAt.toISOString(),

              inventoryRestored:
                restoredItems.length >
                0,

              restoredItems,
            },

            reason:
              input.cancellationReason,
          },
        );
      },
    );

    revalidatePath(
      "/wastage",
    );

    revalidatePath(
      `/wastage/${wastageId}`,
    );

    revalidatePath(
      "/inventory",
    );

    revalidatePath(
      "/inventory/transactions",
    );

    return {
      success: true,

      message:
        "Wastage cancelled successfully.",
    };
  } catch (error: unknown) {
    console.error(
      "CANCEL_WASTAGE_ERROR:",
      error,
    );

    return {
      success: false,

      error:
        safeWastageError(
          error,
        ),
    };
  }
}