export interface AnalyticsDateRangeDto {
  from: string;
  to: string;
  dayCount: number;
  warning: string | null;
}

export interface AnalyticsSummaryDto {
  orderCount: number;
  cancelledOrderCount: number;
  billCount: number;

  grossSales: number;
  refunds: number;
  netSales: number;

  paymentsReceived: number;
  netCollections: number;
  outstandingAmount: number;

  taxAmount: number;
  discountAmount: number;
  averageBillValue: number;

  costOfGoodsSold: number | null;
  grossProfit: number | null;
  grossMarginPercent: number | null;

  wastageCost: number;
  inventoryValue: number | null;
}

export interface DailySalesAnalyticsDto {
  businessDate: string;

  billCount: number;

  grossSales: number;
  refunds: number;
  netSales: number;

  costOfGoodsSold: number | null;
  grossProfit: number | null;
}

export interface TopSellingItemDto {
  key: string;

  itemName: string;
  categoryName: string;

  quantity: number;
  billedNetSales: number;

  costAmount: number | null;
  grossProfit: number | null;
}

export interface PaymentMethodAnalyticsDto {
  method: string;
  transactionCount: number;
  amount: number;
}

export interface WastageReasonAnalyticsDto {
  reason: string;
  itemCount: number;
  quantity: number;
  totalCost: number;
}

export interface LowStockAnalyticsDto {
  id: string;
  name: string;
  code: string;
  unit: string;

  currentStock: number;
  minimumStock: number;
  reorderLevel: number;

  averageCost: number | null;
  stockValue: number | null;

  status:
    | "LOW_STOCK"
    | "OUT_OF_STOCK";
}

export interface AnalyticsDashboardDto {
  range: AnalyticsDateRangeDto;
  summary: AnalyticsSummaryDto;

  dailySales: DailySalesAnalyticsDto[];
  topSellingItems: TopSellingItemDto[];
  paymentMethods: PaymentMethodAnalyticsDto[];
  wastageReasons: WastageReasonAnalyticsDto[];
  lowStockItems: LowStockAnalyticsDto[];

  canViewProfit: boolean;
}