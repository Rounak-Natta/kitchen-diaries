export type RecipeRuleUnit =
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

export type VariationAdjustmentTypeValue =
  | "ADD"
  | "REPLACE"
  | "REMOVE";

export interface RecipeRuleInventoryOptionDto {
  id: string;
  name: string;
  code: string;
  unit: RecipeRuleUnit;
}

export interface VariationRuleListItemDto {
  id: string;
  name: string;
  groupName: string;
  ruleCount: number;
}

export interface AddonRuleListItemDto {
  id: string;
  name: string;
  price: number;
  ruleCount: number;
}

export interface VariationRuleDto {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemCode: string;
  adjustmentType: VariationAdjustmentTypeValue;
  quantity: number;
  unit: RecipeRuleUnit;
  notes: string | null;
}

export interface AddonRuleDto {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemCode: string;
  quantity: number;
  unit: RecipeRuleUnit;
  notes: string | null;
}

export interface VariationRuleEditorDataDto {
  variationOption: {
    id: string;
    name: string;
    groupName: string;
  };

  rules: VariationRuleDto[];

  inventoryItems:
    RecipeRuleInventoryOptionDto[];
}

export interface AddonRuleEditorDataDto {
  addon: {
    id: string;
    name: string;
    price: number;
  };

  rules: AddonRuleDto[];

  inventoryItems:
    RecipeRuleInventoryOptionDto[];
}