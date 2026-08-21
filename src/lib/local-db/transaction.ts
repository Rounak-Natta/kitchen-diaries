import {
  localDb,
} from "./db";

export const LOCAL_DB_TABLES = {
  SYNC_OUTBOX:
    "syncOutbox",

  SYNC_METADATA:
    "syncMetadata",

  SYNC_CURSOR:
    "syncCursor",

  DOCUMENT_NUMBER_RANGES:
    "documentNumberRanges",

  RESTAURANTS: "restaurants",
  CATEGORIES: "categories",
  MENU_ITEMS: "menuItems",
  VARIATIONS: "variations",
  VARIATION_OPTIONS: "variationOptions",
  ADDONS: "addons",
  ORDERS: "orders",
  ORDER_ITEMS: "orderItems",
  ORDER_ITEM_VARIATIONS: "orderItemVariations",
  ORDER_ITEM_ADDONS: "orderItemAddons",
  KOTS: "kots",
  KOT_ITEMS: "kotItems",
  BILLS: "bills",
  PAYMENTS: "payments",
  INVENTORY_CATEGORIES: "inventoryCategories",
  INVENTORY_ITEMS: "inventoryItems",
  INVENTORY_TRANSACTIONS: "inventoryTransactions",
  RECIPES: "recipes",
  RECIPE_ITEMS: "recipeItems",
  WASTAGES: "wastages",
  WASTAGE_ITEMS: "wastageItems",
} as const;

export async function runLocalTransaction<T>(
  tables: string[],
  operation: () => Promise<T>,
): Promise<T> {
  return localDb.transaction(
    "rw",
    tables,
    operation,
  );
}