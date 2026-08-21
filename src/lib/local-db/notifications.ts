import { localDb, type LocalNotification } from "./db";

export interface LocalNotificationInput {
  restaurantId: string;
  title: string;
  message: string;
  type: string;
  dedupeKey: string;
  entityType?: string | null;
  entityId?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
  status?: string | null;
}

function isMissingNotificationStore(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "NotFoundError") return true;

  if (error instanceof Error) {
    return (
      error.name === "NotFoundError" ||
      /object store was not found|specified object store was not found/i.test(error.message)
    );
  }

  return false;
}

async function ignoreOnlyMissingStore(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error: unknown) {
    // Notifications are auxiliary. A stale IndexedDB notification store must
    // never stop order creation, billing or cloud synchronization. Version 8
    // repairs the schema on the next database open.
    if (isMissingNotificationStore(error)) return;
    throw error;
  }
}

export async function createLocalNotification(input: LocalNotificationInput): Promise<void> {
  await ignoreOnlyMissingStore(async () => {
    const existing = await localDb.notifications
      .where("dedupeKey")
      .equals(input.dedupeKey)
      .first();

    if (existing) return;

    const now = new Date().toISOString();
    const notification: LocalNotification = {
      id: crypto.randomUUID(),
      restaurantId: input.restaurantId,
      title: input.title,
      message: input.message,
      type: input.type,
      dedupeKey: input.dedupeKey,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      orderId: input.orderId ?? null,
      orderNumber: input.orderNumber ?? null,
      status: input.status ?? null,
      readAt: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await localDb.notifications.put(notification);
  });
}

export async function rebindLocalNotification(
  currentDedupeKey: string,
  next: { dedupeKey: string; entityId: string; updatedAt?: string },
): Promise<void> {
  await ignoreOnlyMissingStore(async () => {
    const localNotification = await localDb.notifications
      .where("dedupeKey")
      .equals(currentDedupeKey)
      .first();

    if (!localNotification) return;

    await localDb.notifications.put({
      ...localNotification,
      dedupeKey: next.dedupeKey,
      entityId: next.entityId,
      updatedAt: next.updatedAt ?? new Date().toISOString(),
    });
  });
}

export async function listLocalNotifications(restaurantId: string): Promise<LocalNotification[]> {
  try {
    return await localDb.notifications
      .where("restaurantId")
      .equals(restaurantId)
      .toArray();
  } catch (error: unknown) {
    if (isMissingNotificationStore(error)) return [];
    throw error;
  }
}

export async function findLocalNotificationByDedupeKey(
  dedupeKey: string,
): Promise<LocalNotification | undefined> {
  try {
    return await localDb.notifications.where("dedupeKey").equals(dedupeKey).first();
  } catch (error: unknown) {
    if (isMissingNotificationStore(error)) return undefined;
    throw error;
  }
}

export async function markLocalNotificationRead(id: string): Promise<void> {
  await ignoreOnlyMissingStore(async () => {
    await localDb.notifications.update(id, {
      readAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function markAllLocalNotificationsRead(restaurantId: string): Promise<void> {
  await ignoreOnlyMissingStore(async () => {
    const unread = await localDb.notifications
      .where("restaurantId")
      .equals(restaurantId)
      .filter((item) => !item.readAt)
      .toArray();

    const now = new Date().toISOString();
    await localDb.transaction("rw", localDb.notifications, async () => {
      for (const item of unread) {
        await localDb.notifications.update(item.id, {
          readAt: now,
          updatedAt: now,
        });
      }
    });
  });
}
