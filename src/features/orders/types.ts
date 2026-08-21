export type OrderTypeValue =
  | "DINE_IN"
  | "TAKEAWAY"
  | "DELIVERY";

export type OrderStatusValue =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "BILLED"
  | "COMPLETED"
  | "CANCELLED";

export interface MenuCategoryDto {
  id: string;
  name: string;
}

export interface MenuVariationOptionDto {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}

export interface MenuVariationGroupDto {
  id: string;
  name: string;
  options: MenuVariationOptionDto[];
}

export interface MenuVariationLinkDto {
  variationGroup: MenuVariationGroupDto;
}

export interface MenuAddonDto {
  id: string;
  name: string;
  price: number;
}

export interface MenuAddonLinkDto {
  addon: MenuAddonDto;
}

export interface MenuItemDto {
  id: string;
  name: string;
  price: number;

  category: MenuCategoryDto;

  variations: MenuVariationLinkDto[];

  addons: MenuAddonLinkDto[];
}

export interface MenuDataDto {
  menuItems: MenuItemDto[];
  categories: MenuCategoryDto[];
}

export interface CartVariation {
  id: string;
  name: string;
  price: number;
}

export interface CartAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string;

  menuItemId: string;
  name: string;

  basePrice: number;
  unitPrice: number;

  quantity: number;
  notes: string;

  variation: CartVariation | null;
  addons: CartAddon[];
}

export interface OrderListItemDto {
  id: string;
  /** Local offline orders keep the remote/server id after successful sync. */
  serverOrderId?: string | null;
  orderNumber: string;
  orderType: OrderTypeValue;
  status: OrderStatusValue;
  total: number;
  createdAt: string;
  createdByName: string | null;
  totalItems: number;
  billId: string | null;
}

export interface OrderItemDetailsDto {
  id: string;
  itemName: string;
  quantity: number;
  totalPrice: number;
  notes: string | null;
  variationName: string | null;

  addons: Array<{
    id: string;
    name: string;
  }>;
}