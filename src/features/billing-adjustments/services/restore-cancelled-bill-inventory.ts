import {
  InventoryStatus,
  InventoryTransactionType,
  Prisma,
} from "@prisma/client";

import {
  postInventoryTransaction,
} from "@/features/inventory/services/inventory-transaction-service";

export interface RestoreCancelledBillInventoryInput {
  restaurantId: string;
  createdById: string;
  billId: string;
  businessDate: Date;
  reason: string;
}

export interface RestoreCancelledBillInventoryResult {
  alreadyRestored: boolean;
  restoredTransactionCount: number;
  restoredCost: Prisma.Decimal;
  inventoryStatus: InventoryStatus;
}

export async function restoreCancelledBillInventory(
  database: Prisma.TransactionClient,
  input: RestoreCancelledBillInventoryInput,
): Promise<RestoreCancelledBillInventoryResult> {
  const restaurantId =
    input.restaurantId.trim();

  const createdById =
    input.createdById.trim();

  const billId =
    input.billId.trim();

  if (!restaurantId) {
    throw new Error(
      "Restaurant ID is required for inventory restoration.",
    );
  }

  if (!createdById) {
    throw new Error(
      "Inventory restoration user is required.",
    );
  }

  if (!billId) {
    throw new Error(
      "Bill ID is required for inventory restoration.",
    );
  }

  const bill =
    await database.bill.findFirst({
      where: {
        id: billId,
        restaurantId,
      },

      select: {
        id: true,
        billNumber: true,
        orderId: true,
        inventoryPostedAt: true,

        order: {
          select: {
            inventoryStatus: true,
          },
        },

        items: {
          select: {
            id: true,
            itemName: true,

            ingredientSnapshots: {
              select: {
                id: true,
                inventoryItemId: true,
                inventoryItemName: true,
                quantity: true,
                unitCost: true,
                inventoryTransactionId:
                  true,
              },

              orderBy: {
                createdAt: "asc",
              },
            },
          },

          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

  if (!bill) {
    throw new Error(
      "Bill was not found for inventory restoration.",
    );
  }

  if (
    bill.order.inventoryStatus ===
    InventoryStatus.RESTORED
  ) {
    return {
      alreadyRestored: true,
      restoredTransactionCount: 0,
      restoredCost:
        new Prisma.Decimal(0),
      inventoryStatus:
        InventoryStatus.RESTORED,
    };
  }

  if (
    !bill.inventoryPostedAt ||
    bill.order.inventoryStatus ===
      InventoryStatus.NOT_DEDUCTED
  ) {
    return {
      alreadyRestored: false,
      restoredTransactionCount: 0,
      restoredCost:
        new Prisma.Decimal(0),
      inventoryStatus:
        InventoryStatus.NOT_DEDUCTED,
    };
  }

  let restoredTransactionCount = 0;

  let restoredCost =
    new Prisma.Decimal(0);

  for (const billItem of bill.items) {
    for (
      const ingredient of
      billItem.ingredientSnapshots
    ) {
      if (
        !ingredient.inventoryTransactionId
      ) {
        throw new Error(
          `Original inventory transaction is missing for ${ingredient.inventoryItemName}.`,
        );
      }

      const restorationTransaction =
        await postInventoryTransaction(
          database,
          {
            restaurantId,
            createdById,

            inventoryItemId:
              ingredient.inventoryItemId,

            type:
              InventoryTransactionType.REVERSAL,

            quantityChange:
              ingredient.quantity,

            unitCost:
              ingredient.unitCost,

            idempotencyKey:
              `bill:${bill.id}:ingredient:${ingredient.id}:cancel-reversal`,

            reason:
              `Bill cancellation reversal for ${bill.billNumber}: ${input.reason}`,

            referenceType:
              "BILL_CANCELLATION",

            referenceId:
              bill.id,

            businessDate:
              input.businessDate,

            orderId:
              bill.orderId,

            billId:
              bill.id,

            billItemId:
              billItem.id,
          },
        );

      restoredCost = restoredCost
        .plus(
          restorationTransaction.totalCost,
        )
        .toDecimalPlaces(2);

      restoredTransactionCount += 1;
    }
  }

  return {
    alreadyRestored: false,
    restoredTransactionCount,
    restoredCost,
    inventoryStatus:
      InventoryStatus.RESTORED,
  };
}