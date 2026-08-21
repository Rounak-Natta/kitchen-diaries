export interface RestaurantSettingsDto {
  id: string;

  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;

  currency: string;
  timezone: string;
  businessDayStartHour: number;
  defaultTaxRate: number;

  orderPrefix: string;
  billPrefix: string;
  receiptPrefix: string;

  isActive: boolean;
  updatedAt: string;
}