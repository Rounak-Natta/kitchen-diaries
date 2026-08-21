export type InventoryUnitValue =
  | "GRAM"
  | "KILOGRAM"
  | "MILLILITRE"
  | "LITRE"
  | "PIECE"
  | "PACKET"
  | "BOX"
  | "BOTTLE"
  | "CAN"
  | "PORTION";

export type InventoryItemTypeValue =
  | "RAW_MATERIAL"
  | "FINISHED_PRODUCT"
  | "PACKAGING"
  | "CONSUMABLE";

export type InventoryStockStatus =
  | "IN_STOCK"
  | "LOW_STOCK"
  | "OUT_OF_STOCK";

export type ManualInventoryTransactionType =
  | "STOCK_IN"
  | "STOCK_OUT"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT";

export interface InventoryCategoryOptionDto {
  id: string;
  name: string;
}

export interface InventoryItemDto {
  id: string;
  name: string;
  code: string;
  type: InventoryItemTypeValue;
  unit: InventoryUnitValue;

  currentStock: number;
  minimumStock: number;
  reorderLevel: number;
  averageCost: number;

  allowNegativeStock: boolean;
  categoryName: string | null;
  stockStatus: InventoryStockStatus;
}

export interface InventoryItemEditorDto {
  id: string;

  name: string;
  code: string;
  barcode: string | null;
  description: string | null;

  type: InventoryItemTypeValue;
  unit: InventoryUnitValue;

  minimumStock: number;
  reorderLevel: number;

  currentStock: number;
  averageCost: number;

  allowNegativeStock: boolean;
  notes: string | null;
  categoryId: string | null;
}

export interface InventoryItemFormDataDto {
  item: InventoryItemEditorDto | null;
  categories: InventoryCategoryOptionDto[];
}

export interface InventoryTransactionDto {
  id: string;
  transactionNumber: string;

  type: string;

  quantityChange: number;
  stockBefore: number;
  stockAfter: number;

  unit: InventoryUnitValue;
  unitCost: number;
  totalCost: number;

  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemCode: string;

  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;

  orderNumber: string | null;
  billNumber: string | null;

  createdByName: string;
  businessDate: string | null;
  createdAt: string;
}