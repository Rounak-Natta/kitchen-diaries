import { getDeviceId } from "./device";
import { allocateNextDocumentNumber } from "./document-ranges";
import { enqueueOutboxOperation } from "./outbox";
import { getLocalSession } from "./session";
import { getBusinessDateKey } from "@/lib/business-date";
import { createLocalEntity, runLocalEntityTransaction } from "./repositories";
import { createLocalNotification } from "./notifications";

export interface OfflineOrderItemInput {
  menuItemId: string;
  itemName: string;
  quantity: number;
  basePrice: number;
  variationPrice: number;
  addonPrice: number;
  totalPrice: number;
  variationOptionId?: string | null;
  addonIds?: string[];
  notes?: string | null;
}

export interface CreateOfflineOrderInput {
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableNumber?: string;
  notes?: string;
  items: OfflineOrderItemInput[];
  subtotal: number;
  taxRate: number;
  tax: number;
  discount?: number;
  total: number;
  idempotencyKey: string;
}

function businessDate(): string {
  return getBusinessDateKey(new Date());
}

export async function createOfflineOrder(input: CreateOfflineOrderInput) {
  const session = await getLocalSession();
  if (!session) throw new Error("No local session is available.");
  if (!input.items.length) throw new Error("Order must contain at least one item.");

  const deviceId = session.deviceId || await getDeviceId();
  const localOrderId = crypto.randomUUID();
  const now = new Date().toISOString();
  const allocated = await allocateNextDocumentNumber(deviceId, "ORDER", businessDate());
  const orderNumber = allocated !== null ? `ORD-${allocated}` : `OFF-${now.replace(/\D/g, "").slice(0, 14)}-${localOrderId.slice(0, 6).toUpperCase()}`;

  const payload = {
    _createdAt: now,
    _businessDate: businessDate(),
    idempotencyKey: input.idempotencyKey,
    orderType: input.orderType,
    tableNumber: input.tableNumber || undefined,
    notes: input.notes || undefined,
    items: input.items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      variationOptionId: item.variationOptionId || undefined,
      addonIds: item.addonIds ?? [],
      notes: item.notes || undefined,
    })),
  };

  await runLocalEntityTransaction(async () => {
    await createLocalEntity("orders", {
      id: localOrderId,
      restaurantId: session.restaurantId,
      version: 1,
      orderNumber,
      orderType: input.orderType,
      status: "PENDING",
      tableNumber: input.tableNumber || null,
      notes: input.notes || null,
      subtotal: input.subtotal,
      taxRate: input.taxRate,
      tax: input.tax,
      discount: input.discount ?? 0,
      total: input.total,
      idempotencyKey: input.idempotencyKey,
      createdById: session.userId,
    } as never);

    for (const item of input.items) {
      const itemId = crypto.randomUUID();
      await createLocalEntity("orderItems", {
        id: itemId,
        restaurantId: session.restaurantId,
        version: 1,
        orderId: localOrderId,
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        quantity: item.quantity,
        basePrice: item.basePrice,
        variationPrice: item.variationPrice,
        addonPrice: item.addonPrice,
        totalPrice: item.totalPrice,
        variationOptionId: item.variationOptionId ?? null,
        notes: item.notes ?? null,
      } as never);

      for (const addonId of item.addonIds ?? []) {
        await createLocalEntity("orderItemAddons", {
          id: crypto.randomUUID(),
          restaurantId: session.restaurantId,
          version: 1,
          orderItemId: itemId,
          addonId,
        } as never);
      }
    }

    await enqueueOutboxOperation({
      operationId: crypto.randomUUID(),
      deviceId,
      restaurantId: session.restaurantId,
      entityType: "ORDER",
      entityId: localOrderId,
      operationType: "CREATE",
      baseVersion: 0,
      payload,
    });
  });

  // Notification persistence is best-effort and deliberately outside the
  // core order/outbox transaction. A stale notification object store must
  // never make a restaurant lose an order.
  await createLocalNotification({
    restaurantId: session.restaurantId,
    title: "New order created",
    message: `${orderNumber} is ready for confirmation.`,
    type: "ORDER_CREATED",
    dedupeKey: `LOCAL:${localOrderId}:V1:PENDING`,
    entityType: "ORDER",
    entityId: localOrderId,
    orderId: localOrderId,
    orderNumber,
    status: "PENDING",
  });

  return { id: localOrderId, orderNumber, queued: true };
}
