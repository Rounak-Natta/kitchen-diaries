export type WastageStatusValue =
  | "DRAFT"
  | "POSTED"
  | "CANCELLED";

export type WastageReasonValue =
  | "EXPIRED"
  | "SPOILED"
  | "DAMAGED"
  | "PREPARATION_LOSS"
  | "COOKING_LOSS"
  | "ORDER_CANCELLED"
  | "STAFF_MEAL"
  | "SPILLAGE"
  | "OTHER";

export type WastageUnitValue =
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

export interface WastageInventoryOptionDto {
  id: string;
  name: string;
  code: string;
  unit: WastageUnitValue;
  currentStock: number;
  averageCost: number;
}

export interface WastageFormItemDto {
  id: string;
  inventoryItemId: string;
  quantity: number;
  reason: WastageReasonValue;
  notes: string | null;
}

export interface WastageFormDataDto {
  wastage: {
    id: string;
    wastageNumber: string;
    status: WastageStatusValue;
    notes: string | null;
    items: WastageFormItemDto[];
  } | null;

  inventoryItems:
    WastageInventoryOptionDto[];
}

export interface WastageListItemDto {
  id: string;
  wastageNumber: string;
  status: WastageStatusValue;
  businessDate: string | null;
  totalCost: number;
  itemCount: number;
  createdByName: string;
  approvedByName: string | null;
  createdAt: string;
  postedAt: string | null;
}

export interface WastageDetailItemDto {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemCode: string;

  quantity: number;
  unit: WastageUnitValue;
  unitCost: number;
  totalCost: number;

  reason: WastageReasonValue;
  notes: string | null;

  inventoryTransactionNumber:
    string | null;
}

export interface WastageDetailDto {
  id: string;
  wastageNumber: string;
  status: WastageStatusValue;

  businessDate: string | null;
  totalCost: number;
  notes: string | null;

  createdByName: string;
  approvedByName: string | null;

  postedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;

  createdAt: string;

  items: WastageDetailItemDto[];
}