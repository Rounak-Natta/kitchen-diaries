import {
  DocumentType,
  ExportFormat,
  ExportStatus,
  ExportType,
  Prisma,
} from "@prisma/client";

import {
  writeAuditLog,
} from "@/lib/audit-log";
import {
  getBusinessDate,
} from "@/lib/business-date";
import {
  nextDocumentNumber,
} from "@/lib/document-number";
import {
  withSerializableTransaction,
} from "@/lib/transaction";

import type {
  FullDataExportSnapshot,
} from "../types";

interface DataExportActor {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  role: string;
}

interface StartedDataExport {
  id: string;
  exportNumber: string;
  createdAt: Date;
}

interface FullDataSnapshotResult {
  snapshot: FullDataExportSnapshot;
  rowCounts: Record<string, number>;
  totalRows: number;
}

interface CompleteDataExportInput {
  exportId: string;
  exportNumber: string;
  restaurantId: string;
  requestedById: string;

  fileName: string;
  sha256: string;

  generatedAt: Date;
  rowCounts: Record<string, number>;
  totalRows: number;
}

function initialExportFilters(): Prisma.InputJsonObject {
  return {
    scope:
      "FULL_RESTAURANT",

    schemaVersion:
      1,

    passwordHashesIncluded:
      false,
  };
}

export async function startFullDataExport(
  actor: DataExportActor,
): Promise<StartedDataExport> {
  const createdAt =
    new Date();

  const businessDate =
    getBusinessDate(
      createdAt,
    );

  return withSerializableTransaction(
    async (transaction) => {
      const exportNumber =
        await nextDocumentNumber(
          transaction,
          {
            restaurantId:
              actor.restaurantId,

            documentType:
              DocumentType.EXPORT,

            businessDate,
          },
        );

      const dataExport =
        await transaction.dataExport.create({
          data: {
            exportNumber,

            type:
              ExportType.FULL_DATA,

            format:
              ExportFormat.JSON,

            status:
              ExportStatus.PROCESSING,

            filters:
              initialExportFilters(),

            restaurantId:
              actor.restaurantId,

            requestedById:
              actor.id,

            createdAt,
          },

          select: {
            id: true,
            exportNumber: true,
            createdAt: true,
          },
        });

      await writeAuditLog(
        transaction,
        {
          restaurantId:
            actor.restaurantId,

          userId:
            actor.id,

          module:
            "DATA_EXPORT",

          action:
            "START_FULL_DATA_EXPORT",

          entityType:
            "DataExport",

          entityId:
            dataExport.id,

          newData: {
            exportNumber:
              dataExport.exportNumber,

            type:
              ExportType.FULL_DATA,

            format:
              ExportFormat.JSON,

            status:
              ExportStatus.PROCESSING,

            passwordHashesIncluded:
              false,

            businessDate:
              businessDate
                .toISOString()
                .slice(0, 10),
          },
        },
      );

      return dataExport;
    },
  );
}

export async function buildFullDataExportSnapshot(
  actor: DataExportActor,
  exportId: string,
  exportNumber: string,
  generatedAt: Date,
): Promise<FullDataSnapshotResult> {
  return withSerializableTransaction(
    async (transaction) => {
      const [
        restaurant,
        users,
        categories,
        menuItems,
        variationGroups,
        variationOptions,
        menuItemVariations,
        addons,
        menuItemAddons,
        orders,
        orderItems,
        orderItemAddons,
        bills,
        billItems,
        billItemIngredients,
        billPayments,
        billRefunds,
        inventoryCategories,
        inventoryItems,
        inventoryTransactions,
        recipes,
        recipeItems,
        variationRecipeItems,
        addonRecipeItems,
        wastages,
        wastageItems,
        auditLogs,
        businessSequences,
        previousDataExports,
      ] = await Promise.all([
        transaction.restaurant.findUniqueOrThrow({
          where: {
            id:
              actor.restaurantId,
          },
        }),

        /*
         * Password hashes are deliberately excluded.
         */
        transaction.user.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            restaurantId: true,
            createdAt: true,
            updatedAt: true,
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.category.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.menuItem.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.variationGroup.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.variationOption.findMany({
          where: {
            variationGroup: {
              restaurantId:
                actor.restaurantId,
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.menuItemVariation.findMany({
          where: {
            menuItem: {
              restaurantId:
                actor.restaurantId,
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.addon.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.menuItemAddon.findMany({
          where: {
            menuItem: {
              restaurantId:
                actor.restaurantId,
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.order.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.orderItem.findMany({
          where: {
            order: {
              restaurantId:
                actor.restaurantId,
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.orderItemAddon.findMany({
          where: {
            orderItem: {
              order: {
                restaurantId:
                  actor.restaurantId,
              },
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.bill.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.billItem.findMany({
          where: {
            bill: {
              restaurantId:
                actor.restaurantId,
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.billItemIngredient.findMany({
          where: {
            billItem: {
              bill: {
                restaurantId:
                  actor.restaurantId,
              },
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.billPayment.findMany({
          where: {
            bill: {
              restaurantId:
                actor.restaurantId,
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.billRefund.findMany({
          where: {
            bill: {
              restaurantId:
                actor.restaurantId,
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.inventoryCategory.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.inventoryItem.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.inventoryTransaction.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.recipe.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.recipeItem.findMany({
          where: {
            recipe: {
              restaurantId:
                actor.restaurantId,
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.variationRecipeItem.findMany({
          where: {
            variationOption: {
              variationGroup: {
                restaurantId:
                  actor.restaurantId,
              },
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.addonRecipeItem.findMany({
          where: {
            addon: {
              restaurantId:
                actor.restaurantId,
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.wastage.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.wastageItem.findMany({
          where: {
            wastage: {
              restaurantId:
                actor.restaurantId,
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.auditLog.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),

        transaction.businessSequence.findMany({
          where: {
            restaurantId:
              actor.restaurantId,
          },

          orderBy: [
            {
              businessDate:
                "asc",
            },
            {
              documentType:
                "asc",
            },
          ],
        }),

        transaction.dataExport.findMany({
          where: {
            restaurantId:
              actor.restaurantId,

            id: {
              not:
                exportId,
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        }),
      ]);

      const data = {
        restaurant,
        users,
        categories,
        menuItems,
        variationGroups,
        variationOptions,
        menuItemVariations,
        addons,
        menuItemAddons,
        orders,
        orderItems,
        orderItemAddons,
        bills,
        billItems,
        billItemIngredients,
        billPayments,
        billRefunds,
        inventoryCategories,
        inventoryItems,
        inventoryTransactions,
        recipes,
        recipeItems,
        variationRecipeItems,
        addonRecipeItems,
        wastages,
        wastageItems,
        auditLogs,
        businessSequences,
        dataExports:
          previousDataExports,
      };

      const rowCounts: Record<
        string,
        number
      > = {
        restaurant: 1,
        users:
          users.length,
        categories:
          categories.length,
        menuItems:
          menuItems.length,
        variationGroups:
          variationGroups.length,
        variationOptions:
          variationOptions.length,
        menuItemVariations:
          menuItemVariations.length,
        addons:
          addons.length,
        menuItemAddons:
          menuItemAddons.length,
        orders:
          orders.length,
        orderItems:
          orderItems.length,
        orderItemAddons:
          orderItemAddons.length,
        bills:
          bills.length,
        billItems:
          billItems.length,
        billItemIngredients:
          billItemIngredients.length,
        billPayments:
          billPayments.length,
        billRefunds:
          billRefunds.length,
        inventoryCategories:
          inventoryCategories.length,
        inventoryItems:
          inventoryItems.length,
        inventoryTransactions:
          inventoryTransactions.length,
        recipes:
          recipes.length,
        recipeItems:
          recipeItems.length,
        variationRecipeItems:
          variationRecipeItems.length,
        addonRecipeItems:
          addonRecipeItems.length,
        wastages:
          wastages.length,
        wastageItems:
          wastageItems.length,
        auditLogs:
          auditLogs.length,
        businessSequences:
          businessSequences.length,
        dataExports:
          previousDataExports.length,
      };

      const totalRows =
        Object.values(
          rowCounts,
        ).reduce(
          (
            total,
            count,
          ) =>
            total + count,
          0,
        );

      const snapshot:
        FullDataExportSnapshot = {
        manifest: {
          schemaVersion: 1,

          exportNumber,

          exportType:
            "FULL_DATA",

          format:
            "JSON",

          generatedAt:
            generatedAt.toISOString(),

          restaurantId:
            actor.restaurantId,

          requestedBy: {
            id:
              actor.id,

            name:
              actor.name,

            email:
              actor.email,

            role:
              actor.role,
          },

          security: {
            passwordHashesIncluded:
              false,

            omittedFields: [
              "User.password",
            ],
          },

          rowCounts,
          totalRows,
        },

        data,
      };

      return {
        snapshot,
        rowCounts,
        totalRows,
      };
    },
  );
}

export async function completeFullDataExport(
  input: CompleteDataExportInput,
): Promise<void> {
  await withSerializableTransaction(
    async (transaction) => {
      const filters:
        Prisma.InputJsonObject = {
        scope:
          "FULL_RESTAURANT",

        schemaVersion:
          1,

        generatedAt:
          input.generatedAt.toISOString(),

        sha256:
          input.sha256,

        totalRows:
          input.totalRows,

        rowCounts:
          input.rowCounts,

        passwordHashesIncluded:
          false,
      };

      const updateResult =
        await transaction.dataExport.updateMany({
          where: {
            id:
              input.exportId,

            restaurantId:
              input.restaurantId,

            status:
              ExportStatus.PROCESSING,
          },

          data: {
            status:
              ExportStatus.COMPLETED,

            fileName:
              input.fileName,

            filters,

            errorMessage:
              null,

            completedAt:
              input.generatedAt,
          },
        });

      if (
        updateResult.count !== 1
      ) {
        throw new Error(
          "The data export record could not be completed.",
        );
      }

      await writeAuditLog(
        transaction,
        {
          restaurantId:
            input.restaurantId,

          userId:
            input.requestedById,

          module:
            "DATA_EXPORT",

          action:
            "COMPLETE_FULL_DATA_EXPORT",

          entityType:
            "DataExport",

          entityId:
            input.exportId,

          newData: {
            exportNumber:
              input.exportNumber,

            status:
              ExportStatus.COMPLETED,

            fileName:
              input.fileName,

            sha256:
              input.sha256,

            totalRows:
              input.totalRows,

            rowCounts:
              input.rowCounts,

            passwordHashesIncluded:
              false,

            completedAt:
              input.generatedAt.toISOString(),
          },
        },
      );
    },
  );
}

export async function failFullDataExport(
  exportId: string,
  restaurantId: string,
  requestedById: string,
  exportNumber: string,
  errorMessage: string,
): Promise<void> {
  const safeErrorMessage =
    errorMessage
      .trim()
      .slice(
        0,
        1000,
      ) ||
    "The export failed unexpectedly.";

  await withSerializableTransaction(
    async (transaction) => {
      const updateResult =
        await transaction.dataExport.updateMany({
          where: {
            id:
              exportId,

            restaurantId,

            status: {
              in: [
                ExportStatus.PENDING,
                ExportStatus.PROCESSING,
              ],
            },
          },

          data: {
            status:
              ExportStatus.FAILED,

            errorMessage:
              safeErrorMessage,

            completedAt:
              null,
          },
        });

      if (
        updateResult.count !== 1
      ) {
        return;
      }

      await writeAuditLog(
        transaction,
        {
          restaurantId,

          userId:
            requestedById,

          module:
            "DATA_EXPORT",

          action:
            "FAIL_FULL_DATA_EXPORT",

          entityType:
            "DataExport",

          entityId:
            exportId,

          newData: {
            exportNumber,
            status:
              ExportStatus.FAILED,

            errorMessage:
              safeErrorMessage,
          },

          reason:
            safeErrorMessage,
        },
      );
    },
  );
}