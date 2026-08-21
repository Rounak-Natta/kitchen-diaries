export type RecipeInventoryMode =
  | "NONE"
  | "RECIPE"
  | "DIRECT";

export type RecipeInventoryUnit =
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

export interface RecipeListItemDto {
  menuItemId: string;
  menuItemName: string;
  categoryName: string;
  inventoryMode: RecipeInventoryMode;

  recipe: {
    id: string;
    isActive: boolean;
    ingredientCount: number;
    updatedAt: string;
  } | null;
}

export interface RecipeInventoryOptionDto {
  id: string;
  name: string;
  code: string;
  unit: RecipeInventoryUnit;
}

export interface RecipeIngredientDto {
  id: string;
  inventoryItemId: string;

  inventoryItemName: string;
  inventoryItemCode: string;

  quantity: number;
  unit: RecipeInventoryUnit;
  wastagePercent: number;

  notes: string | null;
}

export interface RecipeEditorDataDto {
  menuItem: {
    id: string;
    name: string;
    categoryName: string;
    inventoryMode: RecipeInventoryMode;
  };

  recipe: {
    id: string;
    name: string;
    description: string | null;
    notes: string | null;
    isActive: boolean;
    items: RecipeIngredientDto[];
  } | null;

  inventoryItems: RecipeInventoryOptionDto[];
}