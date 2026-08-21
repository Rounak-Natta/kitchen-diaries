import { localDb, type LocalEntityRecord } from "./db";

export type LocalTableName =
  | "restaurants" | "categories" | "menuItems" | "variations" | "variationOptions"
  | "addons" | "notifications" | "orders" | "orderItems" | "orderItemVariations" | "orderItemAddons"
  | "kots" | "kotItems" | "bills" | "payments" | "refunds" | "inventoryCategories" | "inventoryItems"
  | "inventoryTransactions" | "recipes" | "recipeItems" | "wastages" | "wastageItems";

const tables = {
  restaurants: localDb.restaurants, categories: localDb.categories, menuItems: localDb.menuItems,
  variations: localDb.variations, variationOptions: localDb.variationOptions, addons: localDb.addons,
  notifications: localDb.notifications, orders: localDb.orders, orderItems: localDb.orderItems, orderItemVariations: localDb.orderItemVariations,
  orderItemAddons: localDb.orderItemAddons, kots: localDb.kots, kotItems: localDb.kotItems, bills: localDb.bills, payments: localDb.payments, refunds: localDb.refunds,
  inventoryCategories: localDb.inventoryCategories, inventoryItems: localDb.inventoryItems,
  inventoryTransactions: localDb.inventoryTransactions, recipes: localDb.recipes, recipeItems: localDb.recipeItems,
  wastages: localDb.wastages, wastageItems: localDb.wastageItems,
} as const;

function now() { return new Date().toISOString(); }

export async function saveLocalEntity<T extends LocalEntityRecord>(
  table: LocalTableName, entity: T, options?: { outbox?: Parameters<typeof import("./outbox").enqueueOutboxOperation>[0] },
): Promise<T> {
  const value = { ...entity, createdAt: entity.createdAt ?? now(), updatedAt: now() } as T;
  const target = tables[table] as typeof localDb.categories;
  const outbox = options?.outbox;
  if (outbox) {
    const { enqueueOutboxOperation } = await import("./outbox");
    await localDb.transaction("rw", target, localDb.syncOutbox, async () => {
      await target.put(value as never);
      await enqueueOutboxOperation(outbox);
    });
  } else {
    await target.put(value as never);
  }
  return value;
}

export async function createLocalEntity<T extends LocalEntityRecord>(
  table: LocalTableName, entity: Omit<T, "createdAt" | "updatedAt" | "version"> & Partial<Pick<T, "version">>,
  outbox?: Parameters<typeof import("./outbox").enqueueOutboxOperation>[0],
): Promise<T> {
  const value = { ...entity, version: entity.version ?? 1, createdAt: now(), updatedAt: now() } as T;
  return saveLocalEntity(table, value, outbox ? { outbox } : undefined);
}

export async function updateLocalEntity<T extends LocalEntityRecord>(
  table: LocalTableName, id: string, patch: Partial<T>, outbox?: Parameters<typeof import("./outbox").enqueueOutboxOperation>[0],
): Promise<T> {
  const target = tables[table] as typeof localDb.categories;
  const current = await target.get(id) as T | undefined;
  if (!current) throw new Error(`Local ${table} record ${id} was not found.`);
  const next = { ...current, ...patch, version: (current.version ?? 0) + 1, updatedAt: now() } as T;
  return saveLocalEntity(table, next, outbox ? { outbox } : undefined);
}

export async function deleteLocalEntity(
  table: LocalTableName, id: string, outbox?: Parameters<typeof import("./outbox").enqueueOutboxOperation>[0],
): Promise<void> {
  const target = tables[table] as typeof localDb.categories;
  const current = await target.get(id) as LocalEntityRecord | undefined;
  if (!current) return;
  const patch = { ...current, deletedAt: now(), updatedAt: now(), version: (current.version ?? 0) + 1 };
  await saveLocalEntity(table, patch as never, outbox ? { outbox } : undefined);
}

export async function findLocalEntity<T extends LocalEntityRecord>(table: LocalTableName, id: string): Promise<T | undefined> {
  return (await tables[table].get(id)) as T | undefined;
}

export async function listLocalEntities<T extends LocalEntityRecord>(
  table: LocalTableName, restaurantId: string, options?: { includeDeleted?: boolean },
): Promise<T[]> {
  const records = await tables[table].where("restaurantId").equals(restaurantId).toArray() as T[];
  return options?.includeDeleted ? records : records.filter((item) => !item.deletedAt);
}

export async function runLocalEntityTransaction<T>(operation: () => Promise<T>): Promise<T> {
  return localDb.transaction(
    "rw",
    [
      localDb.restaurants, localDb.categories, localDb.menuItems, localDb.variations,
      localDb.variationOptions, localDb.addons, localDb.orders,
      localDb.orderItems, localDb.orderItemVariations, localDb.orderItemAddons, localDb.kots, localDb.bills,
      localDb.payments, localDb.refunds, localDb.inventoryCategories, localDb.inventoryItems,
      localDb.inventoryTransactions, localDb.recipes, localDb.recipeItems, localDb.wastages,
      localDb.wastageItems, localDb.syncOutbox,
    ],
    operation,
  );
}
