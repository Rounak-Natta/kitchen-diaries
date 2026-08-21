import { getLocalSession } from "./session";
import { localDb } from "./db";
import { enqueueOutboxOperation } from "./outbox";
import { findLocalEntity } from "./repositories";
import { getBusinessDateKey } from "@/lib/business-date";

export async function createOfflineInventoryTransaction(input: {
  inventoryItemId: string;
  type: string;
  quantity: number;
  unitCost?: number;
  reason?: string;
  idempotencyKey: string;
}) {
  const session = await getLocalSession();
  if (!session) throw new Error("No local session is available.");
  const item = await findLocalEntity<any>("inventoryItems", input.inventoryItemId);
  if (!item) throw new Error("Inventory item is not available offline.");
  if (item.restaurantId !== session.restaurantId) throw new Error("Inventory item belongs to another restaurant.");

  const incoming = new Set([
    "OPENING_STOCK",
    "STOCK_IN",
    "ADJUSTMENT_IN",
    "RESTORE",
    "CUSTOMER_RETURN",
  ]).has(input.type);
  const sign = incoming ? 1 : -1;
  const before = Number(item.currentStock ?? 0);
  const after = before + sign * input.quantity;
  if (after < 0 && !item.allowNegativeStock) throw new Error("Insufficient stock.");

  const transactionId = crypto.randomUUID();
  const now = new Date().toISOString();

  await localDb.transaction("rw", localDb.inventoryItems, localDb.inventoryTransactions, localDb.syncOutbox, async () => {
    await localDb.inventoryItems.update(item.id, {
      currentStock: after,
      averageCost: incoming && input.unitCost !== undefined ? input.unitCost : item.averageCost,
      version: Number(item.version ?? 1) + 1,
      updatedAt: now,
    });
    await localDb.inventoryTransactions.put({
      id: transactionId, restaurantId: session.restaurantId, version: 1,
      inventoryItemId: item.id, type: input.type, transactionType: input.type,
      quantity: input.quantity, quantityChange: sign * input.quantity,
      stockBefore: before, stockAfter: after,
      unit: item.unit, unitCost: input.unitCost ?? item.averageCost ?? 0,
      totalCost: input.quantity * (input.unitCost ?? item.averageCost ?? 0),
      reason: input.reason ?? null, idempotencyKey: input.idempotencyKey,
      createdById: session.userId, createdAt: now, updatedAt: now,
    } as never);
    await enqueueOutboxOperation({
      operationId: crypto.randomUUID(), deviceId: session.deviceId,
      restaurantId: session.restaurantId, entityType: "INVENTORY_TRANSACTION",
      entityId: transactionId, operationType: "CREATE",
      payload: {
        ...input,
        _createdAt: now,
        _businessDate: getBusinessDateKey(new Date(now)),
      },
    });
  });

  return { transactionId, currentStock: after, queued: true };
}
