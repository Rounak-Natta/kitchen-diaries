"use server";

import {
  InventoryTransactionType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

import {
  createInventoryTransaction,
} from "../services/inventory-transaction-service";
import type {
  ManualInventoryTransactionType,
} from "../types";
import {
  manualInventoryTransactionSchema,
  type ManualInventoryTransactionInput,
} from "../validations/manual-inventory-transaction-schema";

export type CreateManualInventoryTransactionResult =
  | {
      success: true;
      transaction: {
        id: string;
        transactionNumber: string;
        stockAfter: number;
      };
    }
  | {
      success: false;
      error: string;
    };

const TRANSACTION_TYPE_MAP =
  {
    STOCK_IN:
      InventoryTransactionType.STOCK_IN,

    STOCK_OUT:
      InventoryTransactionType.STOCK_OUT,

    ADJUSTMENT_IN:
      InventoryTransactionType.ADJUSTMENT_IN,

    ADJUSTMENT_OUT:
      InventoryTransactionType.ADJUSTMENT_OUT,
  } satisfies Record<
    ManualInventoryTransactionType,
    InventoryTransactionType
  >;

function canCreateTransaction(
  role: string,
  type: ManualInventoryTransactionType,
): boolean {
  if (type === "STOCK_IN") {
    return hasPermission(
      role,
      PERMISSIONS.INVENTORY_STOCK_IN,
    );
  }

  return hasPermission(
    role,
    PERMISSIONS.INVENTORY_ADJUST,
  );
}

function isOutgoingType(
  type: ManualInventoryTransactionType,
): boolean {
  return (
    type === "STOCK_OUT" ||
    type === "ADJUSTMENT_OUT"
  );
}

function isIncomingType(
  type: ManualInventoryTransactionType,
): boolean {
  return (
    type === "STOCK_IN" ||
    type === "ADJUSTMENT_IN"
  );
}

function safeInventoryError(
  error: unknown,
): string {
  if (!(error instanceof Error)) {
    return "The inventory transaction could not be created.";
  }

  const safeMessages = [
    "insufficient stock",
    "inventory item was not found",
    "quantity change",
    "unit cost",
    "idempotency key",
    "creator is invalid",
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
    : "The inventory transaction could not be created.";
}

export async function createManualInventoryTransaction(
  data: ManualInventoryTransactionInput,
): Promise<CreateManualInventoryTransactionResult> {
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
    manualInventoryTransactionSchema.safeParse(
      data,
    );

  if (!validation.success) {
    return {
      success: false,

      error:
        validation.error.issues[0]
          ?.message ??
        "Invalid inventory transaction.",
    };
  }

  const input =
    validation.data;

  if (
    !canCreateTransaction(
      user.role,
      input.type,
    )
  ) {
    return {
      success: false,
      error:
        "You do not have permission to perform this inventory transaction.",
    };
  }

  const quantityChange =
    isOutgoingType(input.type)
      ? -input.quantity
      : input.quantity;

  const unitCost =
    isIncomingType(input.type)
      ? input.unitCost
      : undefined;

  try {
    const transaction =
      await createInventoryTransaction({
        restaurantId:
          user.restaurantId,

        createdById:
          user.id,

        inventoryItemId:
          input.inventoryItemId,

        type:
          TRANSACTION_TYPE_MAP[
            input.type
          ],

        quantityChange,
        unitCost,

        idempotencyKey:
          input.idempotencyKey,

        reason:
          input.reason,

        referenceType:
          "MANUAL_INVENTORY",
      });

    revalidatePath(
      "/inventory",
    );

    revalidatePath(
      "/inventory/transactions",
    );

    revalidatePath(
      `/inventory/${input.inventoryItemId}/adjust`,
    );

    return {
      success: true,

      transaction: {
        id: transaction.id,

        transactionNumber:
          transaction.transactionNumber,

        stockAfter:
          Number(
            transaction.stockAfter,
          ),
      },
    };
  } catch (error: unknown) {
    console.error(
      "CREATE_MANUAL_INVENTORY_TRANSACTION_ERROR:",
      error,
    );

    return {
      success: false,
      error:
        safeInventoryError(error),
    };
  }
}