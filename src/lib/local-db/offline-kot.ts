import { getDeviceId } from "./device";
import { allocateNextDocumentNumber } from "./document-ranges";
import { localDb } from "./db";
import { enqueueOutboxOperation } from "./outbox";
import { getLocalSession } from "./session";
import { createLocalEntity } from "./repositories";

export async function createOfflineKOT(input: {
  orderId: string;
  tableNumber?: string | null;
  items: Array<{
    menuItemId?: string;
    itemName: string;
    quantity: number;
    variationOptionId?: string | null;
    addonIds?: string[];
    notes?: string | null;
  }>;
  notes?: string | null;
}) {
  const session = await getLocalSession();
  if (!session) throw new Error("No local session is available.");
  const deviceId = session.deviceId || await getDeviceId();
  const date = new Date().toISOString().slice(0, 10);
  const number = await allocateNextDocumentNumber(deviceId, "KOT", date);
  const kotId = crypto.randomUUID();
  const kotNumber = number !== null ? `KOT-${number}` : `OFF-KOT-${Date.now()}`;

  await localDb.transaction("rw", localDb.kots, localDb.kotItems, localDb.syncOutbox, async () => {
    await createLocalEntity("kots", {
      id: kotId, restaurantId: session.restaurantId, version: 1,
      kotNumber, orderId: input.orderId, tableNumber: input.tableNumber ?? null,
      status: "QUEUED", notes: input.notes ?? null,
    } as never);
    for (const item of input.items) {
      await createLocalEntity("kotItems", {
        id: crypto.randomUUID(), restaurantId: session.restaurantId, version: 1,
        kotId, menuItemId: item.menuItemId ?? null, itemName: item.itemName,
        quantity: item.quantity, variationOptionId: item.variationOptionId ?? null,
        addonIds: item.addonIds ?? [], notes: item.notes ?? null,
      } as never);
    }
    await enqueueOutboxOperation({
      operationId: crypto.randomUUID(), deviceId, restaurantId: session.restaurantId,
      entityType: "KOT", entityId: kotId, operationType: "CREATE",
      payload: { kotNumber, orderId: input.orderId, tableNumber: input.tableNumber, items: input.items, notes: input.notes },
    });
  });

  return { id: kotId, kotNumber, queued: true };
}

export async function reprintOfflineKOT(kotId: string) {
  const session = await getLocalSession();
  if (!session) throw new Error("No local session is available.");
  const kot = await localDb.kots.get(kotId);
  if (!kot) throw new Error("KOT was not found.");
  const reprintCount = Number(kot.reprintCount ?? 0) + 1;
  await localDb.kots.update(kotId, { reprintCount, printedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await enqueueOutboxOperation({
    operationId: crypto.randomUUID(), deviceId: session.deviceId, restaurantId: session.restaurantId,
    entityType: "KOT", entityId: kotId, operationType: "REPRINT",
    payload: { reprintCount },
  });
  return { ...kot, reprintCount };
}
