import {
  DocumentType,
  InventoryTransactionType,
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
import { prisma } from "@/lib/prisma";
import {
  withSerializableTransaction,
} from "@/lib/transaction";

type DecimalInput =
  | string
  | number
  | Prisma.Decimal;

const POSITIVE_TRANSACTION_TYPES =
  new Set<InventoryTransactionType>([
    InventoryTransactionType.OPENING_STOCK,
    InventoryTransactionType.STOCK_IN,
    InventoryTransactionType.ADJUSTMENT_IN,
    InventoryTransactionType.RESTORE,
    InventoryTransactionType.CUSTOMER_RETURN,
  ]);

const NEGATIVE_TRANSACTION_TYPES =
  new Set<InventoryTransactionType>([
    InventoryTransactionType.STOCK_OUT,
    InventoryTransactionType.SALE_CONSUMPTION,
    InventoryTransactionType.WASTAGE,
    InventoryTransactionType.ADJUSTMENT_OUT,
  ]);

const INVENTORY_TRANSACTION_SELECT = {
  id: true,
  transactionNumber: true,
  idempotencyKey: true,
  type: true,
  quantityChange: true,
  stockBefore: true,
  stockAfter: true,
  unit: true,
  unitCost: true,
  totalCost: true,
  inventoryItemId: true,
  restaurantId: true,
  businessDate: true,
  createdAt: true,

  inventoryItem: {
    select: {
      name: true,
      code: true,
    },
  },
} satisfies Prisma.InventoryTransactionSelect;

export type InventoryTransactionResult =
  Prisma.InventoryTransactionGetPayload<{
    select:
      typeof INVENTORY_TRANSACTION_SELECT;
  }>;

export interface PostInventoryTransactionInput {
  restaurantId: string;
  createdById: string;
  inventoryItemId: string;

  type: InventoryTransactionType;

  /**
   * Use a positive value for stock-in transactions.
   * Use a negative value for stock-out transactions.
   *
   * Examples:
   * STOCK_IN: 10
   * SALE_CONSUMPTION: -2.5
   */
  quantityChange: DecimalInput;

  /**
   * Optional for stock-in.
   * Stock-out normally uses the inventory item's
   * current average cost.
   */
  unitCost?: DecimalInput | null;

  idempotencyKey?: string | null;

  reason?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;

  businessDate?: Date;

  orderId?: string | null;
  billId?: string | null;
  billItemId?: string | null;
}

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
  value: DecimalInput,
): Prisma.Decimal {
  const decimal =
    new Prisma.Decimal(value);

  if (!decimal.isFinite()) {
    throw new Error(
      "Invalid inventory quantity.",
    );
  }

  return decimal.toDecimalPlaces(3);
}

function toUnitCost(
  value: DecimalInput,
): Prisma.Decimal {
  const decimal =
    new Prisma.Decimal(value);

  if (
    !decimal.isFinite() ||
    decimal.lt(0)
  ) {
    throw new Error(
      "Inventory unit cost must be zero or greater.",
    );
  }

  return decimal.toDecimalPlaces(4);
}

function validateQuantityDirection(
  type: InventoryTransactionType,
  quantityChange: Prisma.Decimal,
): void {
  if (quantityChange.eq(0)) {
    throw new Error(
      "Inventory quantity change cannot be zero.",
    );
  }

  if (
    POSITIVE_TRANSACTION_TYPES.has(
      type,
    ) &&
    quantityChange.lt(0)
  ) {
    throw new Error(
      `${type} requires a positive quantity change.`,
    );
  }

  if (
    NEGATIVE_TRANSACTION_TYPES.has(
      type,
    ) &&
    quantityChange.gt(0)
  ) {
    throw new Error(
      `${type} requires a negative quantity change.`,
    );
  }

  /*
   * REVERSAL can be either positive or negative,
   * depending on the transaction being reversed.
   */
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

function assertValidBusinessDate(
  businessDate: Date,
): void {
  if (
    Number.isNaN(
      businessDate.getTime(),
    )
  ) {
    throw new Error(
      "A valid business date is required.",
    );
  }
}

function assertSameIdempotentRequest(
  existing:
    InventoryTransactionResult,
  input: {
    inventoryItemId: string;
    type: InventoryTransactionType;
    quantityChange: Prisma.Decimal;
  },
): void {
  const isSameRequest =
    existing.inventoryItemId ===
      input.inventoryItemId &&
    existing.type === input.type &&
    existing.quantityChange.eq(
      input.quantityChange,
    );

  if (!isSameRequest) {
    throw new Error(
      "The idempotency key was already used for a different inventory transaction.",
    );
  }
}

async function validateReferences(
  database: Prisma.TransactionClient,
  input: PostInventoryTransactionInput,
): Promise<void> {
  if (input.orderId) {
    const order =
      await database.order.findFirst({
        where: {
          id: input.orderId,
          restaurantId:
            input.restaurantId,
        },

        select: {
          id: true,
        },
      });

    if (!order) {
      throw new Error(
        "The referenced order was not found for this restaurant.",
      );
    }
  }

  let referencedBill:
    | {
        id: string;
        orderId: string;
      }
    | null = null;

  if (input.billId) {
    referencedBill =
      await database.bill.findFirst({
        where: {
          id: input.billId,
          restaurantId:
            input.restaurantId,
        },

        select: {
          id: true,
          orderId: true,
        },
      });

    if (!referencedBill) {
      throw new Error(
        "The referenced bill was not found for this restaurant.",
      );
    }

    if (
      input.orderId &&
      referencedBill.orderId !==
        input.orderId
    ) {
      throw new Error(
        "The referenced bill does not belong to the referenced order.",
      );
    }
  }

  if (input.billItemId) {
    const billItem =
      await database.billItem.findFirst({
        where: {
          id: input.billItemId,

          bill: {
            restaurantId:
              input.restaurantId,
          },
        },

        select: {
          id: true,
          billId: true,
        },
      });

    if (!billItem) {
      throw new Error(
        "The referenced bill item was not found for this restaurant.",
      );
    }

    if (
      input.billId &&
      billItem.billId !==
        input.billId
    ) {
      throw new Error(
        "The referenced bill item does not belong to the referenced bill.",
      );
    }
  }
}

function calculateAverageCost(
  stockBefore: Prisma.Decimal,
  previousAverageCost:
    Prisma.Decimal,
  quantityChange:
    Prisma.Decimal,
  receivedUnitCost:
    Prisma.Decimal | null,
): Prisma.Decimal {
  if (
    quantityChange.lte(0) ||
    receivedUnitCost === null
  ) {
    return previousAverageCost
      .toDecimalPlaces(4);
  }

  const positiveStockBefore =
    stockBefore.gt(0)
      ? stockBefore
      : toQuantity(0);

  const totalQuantity =
    positiveStockBefore.plus(
      quantityChange,
    );

  if (totalQuantity.lte(0)) {
    return receivedUnitCost
      .toDecimalPlaces(4);
  }

  const previousStockValue =
    positiveStockBefore.mul(
      previousAverageCost,
    );

  const receivedStockValue =
    quantityChange.mul(
      receivedUnitCost,
    );

  return previousStockValue
    .plus(receivedStockValue)
    .div(totalQuantity)
    .toDecimalPlaces(4);
}

/**
 * Posts an inventory movement inside an existing
 * Prisma transaction.
 *
 * Use this function when inventory must be committed
 * atomically with billing, wastage, returns, or recipes.
 */
export async function postInventoryTransaction(
  database: Prisma.TransactionClient,
  input: PostInventoryTransactionInput,
): Promise<InventoryTransactionResult> {
  const restaurantId =
    input.restaurantId.trim();

  const createdById =
    input.createdById.trim();

  const inventoryItemId =
    input.inventoryItemId.trim();

  const idempotencyKey =
    normalizeOptionalText(
      input.idempotencyKey,
    );

  if (!restaurantId) {
    throw new Error(
      "Restaurant ID is required.",
    );
  }

  if (!createdById) {
    throw new Error(
      "Inventory transaction creator is required.",
    );
  }

  if (!inventoryItemId) {
    throw new Error(
      "Inventory item ID is required.",
    );
  }

  if (
    idempotencyKey &&
    idempotencyKey.length > 200
  ) {
    throw new Error(
      "Inventory idempotency key is too long.",
    );
  }

  const quantityChange =
    toQuantity(
      input.quantityChange,
    );

  validateQuantityDirection(
    input.type,
    quantityChange,
  );

  if (idempotencyKey) {
    const existing =
      await database.inventoryTransaction.findUnique(
        {
          where: {
            restaurantId_idempotencyKey:
              {
                restaurantId,
                idempotencyKey,
              },
          },

          select:
            INVENTORY_TRANSACTION_SELECT,
        },
      );

    if (existing) {
      assertSameIdempotentRequest(
        existing,
        {
          inventoryItemId,
          type: input.type,
          quantityChange,
        },
      );

      return existing;
    }
  }

  const creator =
    await database.user.findFirst({
      where: {
        id: createdById,
        restaurantId,
        isActive: true,
      },

      select: {
        id: true,
      },
    });

  if (!creator) {
    throw new Error(
      "The inventory transaction creator is invalid.",
    );
  }

  const inventoryItem =
    await database.inventoryItem.findFirst(
      {
        where: {
          id: inventoryItemId,
          restaurantId,
          isActive: true,
          deletedAt: null,
        },

        select: {
          id: true,
          name: true,
          code: true,
          unit: true,
          currentStock: true,
          averageCost: true,
          allowNegativeStock: true,
        },
      },
    );

  if (!inventoryItem) {
    throw new Error(
      "The inventory item was not found or is inactive.",
    );
  }

  await validateReferences(
    database,
    {
      ...input,
      restaurantId,
      createdById,
      inventoryItemId,
    },
  );

  const stockBefore =
    inventoryItem.currentStock
      .toDecimalPlaces(3);

  const stockAfter =
    stockBefore
      .plus(quantityChange)
      .toDecimalPlaces(3);

  if (
    !inventoryItem.allowNegativeStock &&
    stockAfter.lt(0)
  ) {
    throw new Error(
      `Insufficient stock for ${inventoryItem.name}. Available: ${stockBefore.toString()} ${inventoryItem.unit}.`,
    );
  }

  const requestedUnitCost =
    input.unitCost === null ||
    input.unitCost === undefined
      ? null
      : toUnitCost(
          input.unitCost,
        );

  const isStandardStockOut =
    NEGATIVE_TRANSACTION_TYPES.has(
      input.type,
    );

  const effectiveUnitCost =
    isStandardStockOut
      ? inventoryItem.averageCost
          .toDecimalPlaces(4)
      : (
          requestedUnitCost ??
          inventoryItem.averageCost
        ).toDecimalPlaces(4);

  const nextAverageCost =
    calculateAverageCost(
      stockBefore,
      inventoryItem.averageCost,
      quantityChange,
      requestedUnitCost,
    );

  const totalCost =
    quantityChange
      .abs()
      .mul(effectiveUnitCost)
      .toDecimalPlaces(2);

  const createdAt =
    new Date();

  const businessDate =
    input.businessDate ??
    getBusinessDate(createdAt);

  assertValidBusinessDate(
    businessDate,
  );

  const transactionNumber =
    await nextDocumentNumber(
      database,
      {
        restaurantId,

        documentType:
          DocumentType.INVENTORY_TRANSACTION,

        businessDate,
      },
    );

  await database.inventoryItem.update({
    where: {
      id: inventoryItem.id,
    },

    data: {
      currentStock:
        stockAfter,

      averageCost:
        nextAverageCost,
    },
  });

  const createdTransaction =
    await database.inventoryTransaction.create(
      {
        data: {
          transactionNumber,
          idempotencyKey,

          type: input.type,

          quantityChange,
          stockBefore,
          stockAfter,

          unit:
            inventoryItem.unit,

          unitCost:
            effectiveUnitCost,

          totalCost,

          reason:
            normalizeOptionalText(
              input.reason,
            ),

          referenceType:
            normalizeOptionalText(
              input.referenceType,
            ),

          referenceId:
            normalizeOptionalText(
              input.referenceId,
            ),

          businessDate,

          inventoryItemId:
            inventoryItem.id,

          restaurantId,
          createdById,

          orderId:
            input.orderId ?? null,

          billId:
            input.billId ?? null,

          billItemId:
            input.billItemId ?? null,

          createdAt,
        },

        select:
          INVENTORY_TRANSACTION_SELECT,
      },
    );

  await writeAuditLog(
    database,
    {
      restaurantId,
      userId: createdById,

      module: "INVENTORY",
      action:
        "POST_TRANSACTION",

      entityType:
        "InventoryTransaction",

      entityId:
        createdTransaction.id,

      oldData: {
        inventoryItemId:
          inventoryItem.id,

        inventoryItemName:
          inventoryItem.name,

        currentStock:
          stockBefore.toString(),

        averageCost:
          inventoryItem.averageCost.toString(),
      },

      newData: {
        transactionNumber,

        inventoryItemId:
          inventoryItem.id,

        inventoryItemName:
          inventoryItem.name,

        inventoryItemCode:
          inventoryItem.code,

        type: input.type,

        quantityChange:
          quantityChange.toString(),

        stockBefore:
          stockBefore.toString(),

        stockAfter:
          stockAfter.toString(),

        unit:
          inventoryItem.unit,

        unitCost:
          effectiveUnitCost.toString(),

        totalCost:
          totalCost.toString(),

        averageCost:
          nextAverageCost.toString(),

        referenceType:
          normalizeOptionalText(
            input.referenceType,
          ),

        referenceId:
          normalizeOptionalText(
            input.referenceId,
          ),
      },

      reason:
        normalizeOptionalText(
          input.reason,
        ),
    },
  );

  return createdTransaction;
}

/**
 * Standalone transaction wrapper.
 *
 * Use this for manual stock-in, stock-out,
 * opening stock, and stock adjustments.
 */
export async function createInventoryTransaction(
  input: PostInventoryTransactionInput,
): Promise<InventoryTransactionResult> {
  try {
    return await withSerializableTransaction(
      (database) =>
        postInventoryTransaction(
          database,
          input,
        ),
    );
  } catch (error: unknown) {
    const restaurantId =
      input.restaurantId.trim();

    const idempotencyKey =
      normalizeOptionalText(
        input.idempotencyKey,
      );

    if (
      isUniqueConstraintError(
        error,
      ) &&
      restaurantId &&
      idempotencyKey
    ) {
      const existing =
        await prisma.inventoryTransaction.findUnique(
          {
            where: {
              restaurantId_idempotencyKey:
                {
                  restaurantId,
                  idempotencyKey,
                },
            },

            select:
              INVENTORY_TRANSACTION_SELECT,
          },
        );

      if (existing) {
        assertSameIdempotentRequest(
          existing,
          {
            inventoryItemId:
              input.inventoryItemId.trim(),

            type: input.type,

            quantityChange:
              toQuantity(
                input.quantityChange,
              ),
          },
        );

        return existing;
      }
    }

    throw error;
  }
}