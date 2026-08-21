import Dexie, { type Table } from "dexie";

// ======================================================
// LOCAL DATABASE
// ======================================================

export type SyncOutboxStatus = "PENDING" | "SYNCING" | "RETRYING" | "FAILED" | "CONFLICT" | "COMPLETED";

export interface BaseLocalRecord {
  id: string;
  restaurantId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type JsonRecord = Record<string, unknown>;

export interface LocalRestaurant extends BaseLocalRecord { name: string; [key: string]: unknown; }
export interface LocalCategory extends BaseLocalRecord { name: string; [key: string]: unknown; }
export interface LocalMenuItem extends BaseLocalRecord { name: string; price: number; categoryId: string; [key: string]: unknown; }
export interface LocalVariation extends BaseLocalRecord { name: string; [key: string]: unknown; }
export interface LocalVariationOption extends BaseLocalRecord { name: string; variationGroupId: string; [key: string]: unknown; }
export interface LocalAddon extends BaseLocalRecord { name: string; price: number; [key: string]: unknown; }
export interface LocalOrder extends BaseLocalRecord {
  orderNumber: string;
  status: string;
  total: number;
  serverOrderId?: string;
  idempotencyKey?: string;
  [key: string]: unknown;
}
export interface LocalNotification extends BaseLocalRecord {
  title: string;
  message: string;
  type: string;
  dedupeKey: string;
  readAt?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
  status?: string | null;
}
export interface LocalOrderItem extends BaseLocalRecord { orderId: string; menuItemId: string; quantity: number; [key: string]: unknown; }
export interface LocalOrderItemVariation extends BaseLocalRecord { orderItemId: string; variationOptionId: string; [key: string]: unknown; }
export interface LocalOrderItemAddon extends BaseLocalRecord { orderItemId: string; addonId: string; [key: string]: unknown; }
export interface LocalKot extends BaseLocalRecord { kotNumber: string; orderId: string; status: string; [key: string]: unknown; }
export interface LocalKotItem extends BaseLocalRecord { kotId: string; itemName: string; quantity: number; [key: string]: unknown; }
export interface LocalBill extends BaseLocalRecord { billNumber: string; orderId: string; grandTotal: number; serverBillId?: string; idempotencyKey?: string; [key: string]: unknown; }
export interface LocalPayment extends BaseLocalRecord { billId: string; amount: number; method: string; [key: string]: unknown; }
export interface LocalRefund extends BaseLocalRecord { billId: string; amount: number; method: string; reason: string; [key: string]: unknown; }
export interface LocalInventoryItem extends BaseLocalRecord { name: string; currentStock: number; [key: string]: unknown; }
export interface LocalInventoryCategory extends BaseLocalRecord { name: string; [key: string]: unknown; }
export interface LocalInventoryTransaction extends BaseLocalRecord { inventoryItemId: string; quantity: number; transactionType: string; [key: string]: unknown; }
export interface LocalRecipe extends BaseLocalRecord { menuItemId: string; name: string; [key: string]: unknown; }
export interface LocalRecipeItem extends BaseLocalRecord { recipeId: string; inventoryItemId: string; quantity: number; [key: string]: unknown; }
export interface LocalWastage extends BaseLocalRecord { wastageNumber: string; status: string; totalCost: number; [key: string]: unknown; }
export interface LocalWastageItem extends BaseLocalRecord { wastageId: string; inventoryItemId: string; quantity: number; [key: string]: unknown; }

export interface SyncOutboxRecord {
  id?: number;
  operationId: string;
  deviceId: string;
  restaurantId: string;
  entityType: string;
  entityId: string;
  operationType: string;
  baseVersion?: number;
  payload: string;
  status: SyncOutboxStatus;
  attemptCount: number;
  nextRetryAt?: string | null;
  lastError: string | null;
  createdAt: string;
  processedAt: string | null;
  updatedAt: string;
}

export interface SyncMetadataRecord { key: string; value: string; }
export interface SyncCursorRecord { id: "default"; cursor: string | null; updatedAt: string; }
export interface SyncAppliedOperationRecord { operationId: string; appliedAt: string; }
export interface LocalMigrationRecord { id: string; version: number; appliedAt: string; checksum?: string; }
export interface DocumentNumberRangeRecord {
  id: string; deviceId: string; restaurantId: string; documentType: string; businessDate: string;
  startValue: number; endValue: number; nextValue: number; createdAt: string;
}

export type LocalEntityRecord =
  | LocalRestaurant | LocalCategory | LocalMenuItem | LocalVariation | LocalVariationOption
  | LocalAddon | LocalNotification | LocalOrder | LocalOrderItem | LocalOrderItemVariation | LocalOrderItemAddon
  | LocalKot | LocalBill | LocalPayment | LocalInventoryItem | LocalInventoryCategory
  | LocalInventoryTransaction | LocalRecipe | LocalRecipeItem | LocalWastage | LocalWastageItem;

const LOCAL_DATABASE_NAME = "kitchen-diaries-local";
const LOCAL_DATABASE_VERSION = 8;

export class KitchenDiariesDatabase extends Dexie {
  restaurants!: Table<LocalRestaurant, string>;
  categories!: Table<LocalCategory, string>;
  menuItems!: Table<LocalMenuItem, string>;
  variations!: Table<LocalVariation, string>;
  variationOptions!: Table<LocalVariationOption, string>;
  addons!: Table<LocalAddon, string>;
  orders!: Table<LocalOrder, string>;
  orderItems!: Table<LocalOrderItem, string>;
  orderItemVariations!: Table<LocalOrderItemVariation, string>;
  orderItemAddons!: Table<LocalOrderItemAddon, string>;
  kots!: Table<LocalKot, string>;
  kotItems!: Table<LocalKotItem, string>;
  bills!: Table<LocalBill, string>;
  payments!: Table<LocalPayment, string>;
  refunds!: Table<LocalRefund, string>;
  inventoryCategories!: Table<LocalInventoryCategory, string>;
  inventoryItems!: Table<LocalInventoryItem, string>;
  inventoryTransactions!: Table<LocalInventoryTransaction, string>;
  recipes!: Table<LocalRecipe, string>;
  recipeItems!: Table<LocalRecipeItem, string>;
  wastages!: Table<LocalWastage, string>;
  wastageItems!: Table<LocalWastageItem, string>;
  notifications!: Table<LocalNotification, string>;

  syncOutbox!: Table<SyncOutboxRecord, number>;
  syncMetadata!: Table<SyncMetadataRecord, string>;
  syncCursor!: Table<SyncCursorRecord, "default">;
  syncAppliedOperations!: Table<SyncAppliedOperationRecord, string>;
  localMigrations!: Table<LocalMigrationRecord, string>;
  syncEntities!: Table<JsonRecord & { id: string }, string>;
  documentNumberRanges!: Table<DocumentNumberRangeRecord, string>;

  constructor() {
    super(LOCAL_DATABASE_NAME);

    this.version(1).stores({
      syncOutbox: "++id, operationId, deviceId, restaurantId, status, createdAt, [status+createdAt]",
      syncMetadata: "key",
      syncCursor: "id",
      syncEntities: "id, restaurantId, entityType, entityId, [restaurantId+entityType], [restaurantId+entityType+entityId], updatedAt",
      documentNumberRanges: "id, deviceId, restaurantId, [deviceId+documentType+businessDate]",
    });

    this.version(2).stores({
      syncOutbox: "++id, operationId, deviceId, restaurantId, status, createdAt, [status+createdAt]",
      syncMetadata: "key",
      syncCursor: "id",
      syncEntities: "id, restaurantId, entityType, entityId, [restaurantId+entityType], [restaurantId+entityType+entityId], updatedAt",
      documentNumberRanges: "id, deviceId, restaurantId, [deviceId+documentType+businessDate]",
    });

    this.version(3).stores({
      restaurants: "id, restaurantId, updatedAt",
      categories: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      menuItems: "id, restaurantId, categoryId, [restaurantId+updatedAt], updatedAt",
      variations: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      variationOptions: "id, restaurantId, variationGroupId, [restaurantId+updatedAt], updatedAt",
      addons: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      orders: "id, restaurantId, orderNumber, status, [restaurantId+updatedAt], updatedAt",
      orderItems: "id, restaurantId, orderId, menuItemId",
      orderItemVariations: "id, restaurantId, orderItemId, variationOptionId",
      orderItemAddons: "id, restaurantId, orderItemId, addonId",
      kots: "id, restaurantId, orderId, kotNumber, status, updatedAt",
      kotItems: "id, restaurantId, kotId",
      bills: "id, restaurantId, orderId, billNumber, paymentStatus, updatedAt",
      payments: "id, restaurantId, billId, method, createdAt",
      refunds: "id, restaurantId, billId, createdAt",
      inventoryCategories: "id, restaurantId, updatedAt",
      inventoryItems: "id, restaurantId, categoryId, [restaurantId+updatedAt], updatedAt",
      inventoryTransactions: "id, restaurantId, inventoryItemId, transactionType, createdAt",
      recipes: "id, restaurantId, menuItemId, updatedAt",
      recipeItems: "id, restaurantId, recipeId, inventoryItemId",
      wastages: "id, restaurantId, status, wastageNumber, updatedAt",
      wastageItems: "id, restaurantId, wastageId, inventoryItemId",
      syncOutbox: "++id, operationId, deviceId, restaurantId, status, createdAt, [status+createdAt], nextRetryAt",
      syncMetadata: "key",
      syncCursor: "id",
      syncAppliedOperations: "operationId, appliedAt",
      localMigrations: "id, version, appliedAt",
      syncEntities: "id, restaurantId, entityType, entityId, [restaurantId+entityType], [restaurantId+entityType+entityId], updatedAt",
      documentNumberRanges: "id, deviceId, restaurantId, [deviceId+documentType+businessDate]",
    });

    this.version(4)
      .stores({
        restaurants: "id, restaurantId, updatedAt",
        categories: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
        menuItems: "id, restaurantId, categoryId, [restaurantId+updatedAt], updatedAt",
        variations: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
        variationOptions: "id, restaurantId, variationGroupId, [restaurantId+updatedAt], updatedAt",
        addons: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
        orders: "id, restaurantId, orderNumber, status, [restaurantId+updatedAt], updatedAt",
        orderItems: "id, restaurantId, orderId, menuItemId",
        orderItemVariations: "id, restaurantId, orderItemId, variationOptionId",
        orderItemAddons: "id, restaurantId, orderItemId, addonId",
        kots: "id, restaurantId, orderId, kotNumber, status, updatedAt",
        kotItems: "id, restaurantId, kotId",
        bills: "id, restaurantId, orderId, billNumber, paymentStatus, createdAt, updatedAt",
        payments: "id, restaurantId, billId, method, createdAt",
        refunds: "id, restaurantId, billId, createdAt",
        inventoryCategories: "id, restaurantId, updatedAt",
        inventoryItems: "id, restaurantId, categoryId, [restaurantId+updatedAt], updatedAt",
        inventoryTransactions: "id, restaurantId, inventoryItemId, transactionType, createdAt",
        recipes: "id, restaurantId, menuItemId, updatedAt",
        recipeItems: "id, restaurantId, recipeId, inventoryItemId",
        wastages: "id, restaurantId, status, wastageNumber, updatedAt",
        wastageItems: "id, restaurantId, wastageId, inventoryItemId",
        syncOutbox: "++id, &operationId, deviceId, restaurantId, status, createdAt, [status+createdAt], nextRetryAt",
        syncMetadata: "key",
        syncCursor: "id",
        syncAppliedOperations: "operationId, appliedAt",
        localMigrations: "id, version, appliedAt",
        syncEntities: "id, restaurantId, entityType, entityId, [restaurantId+entityType], [restaurantId+entityType+entityId], updatedAt",
        documentNumberRanges: "id, deviceId, restaurantId, [deviceId+documentType+businessDate]",
      })
      .upgrade((tx) =>
        tx.table("syncOutbox").toArray().then(async (rows) => {
          const seen = new Set<string>();
          for (const row of rows.sort((a: SyncOutboxRecord, b: SyncOutboxRecord) =>
            a.createdAt.localeCompare(b.createdAt),
          )) {
            if (seen.has(row.operationId)) {
              if (row.id !== undefined) {
                await tx.table("syncOutbox").delete(row.id);
              }
            } else {
              seen.add(row.operationId);
            }
          }
        }),
      );

    // Version 5: repair missing business-date query indexes on financial tables
    // for existing installations. Dexie applies this upgrade atomically.
    this.version(5).stores({
      restaurants: "id, restaurantId, updatedAt",
      categories: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      menuItems: "id, restaurantId, categoryId, [restaurantId+updatedAt], updatedAt",
      variations: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      variationOptions: "id, restaurantId, variationGroupId, [restaurantId+updatedAt], updatedAt",
      addons: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      orders: "id, restaurantId, orderNumber, status, createdAt, [restaurantId+updatedAt], updatedAt",
      orderItems: "id, restaurantId, orderId, menuItemId",
      orderItemVariations: "id, restaurantId, orderItemId, variationOptionId",
      orderItemAddons: "id, restaurantId, orderItemId, addonId",
      kots: "id, restaurantId, orderId, kotNumber, status, createdAt, updatedAt",
      kotItems: "id, restaurantId, kotId",
      bills: "id, restaurantId, orderId, billNumber, paymentStatus, createdAt, [restaurantId+createdAt], updatedAt",
      payments: "id, restaurantId, billId, method, createdAt",
      refunds: "id, restaurantId, billId, createdAt",
      inventoryCategories: "id, restaurantId, updatedAt",
      inventoryItems: "id, restaurantId, categoryId, [restaurantId+updatedAt], updatedAt",
      inventoryTransactions: "id, restaurantId, inventoryItemId, transactionType, createdAt",
      recipes: "id, restaurantId, menuItemId, updatedAt",
      recipeItems: "id, restaurantId, recipeId, inventoryItemId",
      wastages: "id, restaurantId, status, wastageNumber, updatedAt",
      wastageItems: "id, restaurantId, wastageId, inventoryItemId",
      syncOutbox: "++id, &operationId, deviceId, restaurantId, status, createdAt, [status+createdAt], nextRetryAt",
      syncMetadata: "key",
      syncCursor: "id",
      syncAppliedOperations: "operationId, appliedAt",
      localMigrations: "id, version, appliedAt",
      syncEntities: "id, restaurantId, entityType, entityId, [restaurantId+entityType], [restaurantId+entityType+entityId], updatedAt",
      documentNumberRanges: "id, deviceId, restaurantId, [deviceId+documentType+businessDate]",
    });

    // Version 6: persistent local notification inbox for offline-first lifecycle events.
    this.version(6).stores({
      restaurants: "id, restaurantId, updatedAt",
      categories: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      menuItems: "id, restaurantId, categoryId, [restaurantId+updatedAt], updatedAt",
      variations: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      variationOptions: "id, restaurantId, variationGroupId, [restaurantId+updatedAt], updatedAt",
      addons: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      orders: "id, restaurantId, orderNumber, status, createdAt, [restaurantId+updatedAt], updatedAt",
      orderItems: "id, restaurantId, orderId, menuItemId",
      orderItemVariations: "id, restaurantId, orderItemId, variationOptionId",
      orderItemAddons: "id, restaurantId, orderItemId, addonId",
      kots: "id, restaurantId, orderId, kotNumber, status, createdAt, updatedAt",
      kotItems: "id, restaurantId, kotId",
      bills: "id, restaurantId, orderId, billNumber, paymentStatus, createdAt, [restaurantId+createdAt], updatedAt",
      payments: "id, restaurantId, billId, method, createdAt",
      refunds: "id, restaurantId, billId, createdAt",
      inventoryCategories: "id, restaurantId, updatedAt",
      inventoryItems: "id, restaurantId, categoryId, [restaurantId+updatedAt], updatedAt",
      inventoryTransactions: "id, restaurantId, inventoryItemId, transactionType, createdAt",
      recipes: "id, restaurantId, menuItemId, updatedAt",
      recipeItems: "id, restaurantId, recipeId, inventoryItemId",
      wastages: "id, restaurantId, status, wastageNumber, updatedAt",
      wastageItems: "id, restaurantId, wastageId, inventoryItemId",
      notifications: "id, restaurantId, createdAt, readAt, dedupeKey, [restaurantId+createdAt]",
      syncOutbox: "++id, &operationId, deviceId, restaurantId, status, createdAt, [status+createdAt], nextRetryAt",
      syncMetadata: "key",
      syncCursor: "id",
      syncAppliedOperations: "operationId, appliedAt",
      localMigrations: "id, version, appliedAt",
      syncEntities: "id, restaurantId, entityType, entityId, [restaurantId+entityType], [restaurantId+entityType+entityId], updatedAt",
      documentNumberRanges: "id, deviceId, restaurantId, [deviceId+documentType+businessDate]",
    });

    // Version 7: force creation of the notification object store on devices
    // that previously opened an older v6 schema. The notification store was
    // introduced without a Dexie version bump in an earlier build, so those
    // installations can report `IDBTransaction: object store was not found`.
    // Bumping the schema is non-destructive: Dexie upgrades the existing DB
    // in place and preserves restaurant/order/billing/outbox data.
    this.version(7).stores({
      restaurants: "id, restaurantId, updatedAt",
      categories: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      menuItems: "id, restaurantId, categoryId, [restaurantId+updatedAt], updatedAt",
      variations: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      variationOptions: "id, restaurantId, variationGroupId, [restaurantId+updatedAt], updatedAt",
      addons: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      orders: "id, restaurantId, orderNumber, status, createdAt, [restaurantId+updatedAt], updatedAt",
      orderItems: "id, restaurantId, orderId, menuItemId",
      orderItemVariations: "id, restaurantId, orderItemId, variationOptionId",
      orderItemAddons: "id, restaurantId, orderItemId, addonId",
      kots: "id, restaurantId, orderId, kotNumber, status, createdAt, updatedAt",
      kotItems: "id, restaurantId, kotId",
      bills: "id, restaurantId, orderId, billNumber, paymentStatus, createdAt, [restaurantId+createdAt], updatedAt",
      payments: "id, restaurantId, billId, method, createdAt",
      refunds: "id, restaurantId, billId, createdAt",
      inventoryCategories: "id, restaurantId, updatedAt",
      inventoryItems: "id, restaurantId, categoryId, [restaurantId+updatedAt], updatedAt",
      inventoryTransactions: "id, restaurantId, inventoryItemId, transactionType, createdAt",
      recipes: "id, restaurantId, menuItemId, updatedAt",
      recipeItems: "id, restaurantId, recipeId, inventoryItemId",
      wastages: "id, restaurantId, status, wastageNumber, updatedAt",
      wastageItems: "id, restaurantId, wastageId, inventoryItemId",
      notifications: "id, restaurantId, createdAt, readAt, dedupeKey, [restaurantId+createdAt]",
      syncOutbox: "++id, &operationId, deviceId, restaurantId, status, createdAt, [status+createdAt], nextRetryAt",
      syncMetadata: "key",
      syncCursor: "id",
      syncAppliedOperations: "operationId, appliedAt",
      localMigrations: "id, version, appliedAt",
      syncEntities: "id, restaurantId, entityType, entityId, [restaurantId+entityType], [restaurantId+entityType+entityId], updatedAt",
      documentNumberRanges: "id, deviceId, restaurantId, [deviceId+documentType+businessDate]",
    });


    // Version 8: repair devices whose physical IndexedDB schema reached v7
    // without actually containing the notifications object store. Adding the
    // `type` index makes this a real schema change, so Dexie must reconcile
    // the native object store instead of treating v7 and v8 as identical.
    // This upgrade is non-destructive and preserves all operational data.
    this.version(8).stores({
      restaurants: "id, restaurantId, updatedAt",
      categories: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      menuItems: "id, restaurantId, categoryId, [restaurantId+updatedAt], updatedAt",
      variations: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      variationOptions: "id, restaurantId, variationGroupId, [restaurantId+updatedAt], updatedAt",
      addons: "id, restaurantId, [restaurantId+updatedAt], updatedAt",
      orders: "id, restaurantId, orderNumber, status, createdAt, [restaurantId+updatedAt], updatedAt",
      orderItems: "id, restaurantId, orderId, menuItemId",
      orderItemVariations: "id, restaurantId, orderItemId, variationOptionId",
      orderItemAddons: "id, restaurantId, orderItemId, addonId",
      kots: "id, restaurantId, orderId, kotNumber, status, createdAt, updatedAt",
      kotItems: "id, restaurantId, kotId",
      bills: "id, restaurantId, orderId, billNumber, paymentStatus, createdAt, [restaurantId+createdAt], updatedAt",
      payments: "id, restaurantId, billId, method, createdAt",
      refunds: "id, restaurantId, billId, createdAt",
      inventoryCategories: "id, restaurantId, updatedAt",
      inventoryItems: "id, restaurantId, categoryId, [restaurantId+updatedAt], updatedAt",
      inventoryTransactions: "id, restaurantId, inventoryItemId, transactionType, createdAt",
      recipes: "id, restaurantId, menuItemId, updatedAt",
      recipeItems: "id, restaurantId, recipeId, inventoryItemId",
      wastages: "id, restaurantId, status, wastageNumber, updatedAt",
      wastageItems: "id, restaurantId, wastageId, inventoryItemId",
      notifications: "id, restaurantId, type, createdAt, readAt, dedupeKey, [restaurantId+createdAt]",
      syncOutbox: "++id, &operationId, deviceId, restaurantId, status, createdAt, [status+createdAt], nextRetryAt",
      syncMetadata: "key",
      syncCursor: "id",
      syncAppliedOperations: "operationId, appliedAt",
      localMigrations: "id, version, appliedAt",
      syncEntities: "id, restaurantId, entityType, entityId, [restaurantId+entityType], [restaurantId+entityType+entityId], updatedAt",
      documentNumberRanges: "id, deviceId, restaurantId, [deviceId+documentType+businessDate]",
    });
  }
}

export const localDb = new KitchenDiariesDatabase();
export const LOCAL_DB_VERSION = LOCAL_DATABASE_VERSION;
