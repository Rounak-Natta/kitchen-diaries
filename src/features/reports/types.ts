export interface ReportRangeDto {
  from: string;
  to: string;
  dayCount: number;
  warning: string | null;
}

export interface ReportSummaryDto {
  billCount: number;

  grossSales: number;
  refunds: number;
  netSales: number;

  paymentsReceived: number;
  netCollections: number;
  outstandingAmount: number;

  costOfGoodsSold: number | null;
  grossProfit: number | null;
  grossMarginPercent: number | null;

  wastageCost: number;
  inventoryValue: number | null;

  lowStockCount: number;
  outOfStockCount: number;
}

export interface SalesReportRowDto {
  id: string;

  businessDate: string | null;

  billNumber: string;
  receiptNumber: string | null;
  orderNumber: string;

  customerName: string | null;

  billStatus: string;
  paymentStatus: string;

  grossSales: number;
  refundedAmount: number;
  netSales: number;

  amountPaid: number;
  dueAmount: number;

  taxAmount: number;
  discountAmount: number;

  createdByName: string;
  createdAt: string;
}

export interface PaymentReportRowDto {
  id: string;

  direction:
    | "PAYMENT"
    | "REFUND";

  documentNumber: string | null;

  billNumber: string;
  orderNumber: string;

  method: string;

  amount: number;
  signedAmount: number;

  referenceNo: string | null;
  description: string | null;

  recordedByName: string | null;
  createdAt: string;
}

export interface InventoryReportRowDto {
  id: string;

  name: string;
  code: string;
  categoryName: string;

  unit: string;

  currentStock: number;
  minimumStock: number;
  reorderLevel: number;

  averageCost: number | null;
  stockValue: number | null;

  status:
    | "HEALTHY"
    | "LOW_STOCK"
    | "OUT_OF_STOCK";
}

export interface WastageReportRowDto {
  id: string;

  wastageId: string;
  wastageNumber: string;
  businessDate: string | null;

  inventoryItemName: string;
  inventoryItemCode: string;

  reason: string;

  quantity: number;
  unit: string;

  unitCost: number | null;
  totalCost: number;

  createdByName: string;
  approvedByName: string | null;

  postedAt: string | null;
}

export interface ProfitReportRowDto {
  id: string;

  businessDate: string | null;

  billNumber: string;
  orderNumber: string;

  itemName: string;
  categoryName: string;

  quantity: number;

  billedNetSales: number;
  allocatedRefund: number;
  adjustedNetSales: number;

  costAmount: number;
  grossProfit: number;
  grossMarginPercent: number;
}

export interface ReportsDashboardDto {
  range: ReportRangeDto;
  summary: ReportSummaryDto;

  salesRows: SalesReportRowDto[];
  paymentRows: PaymentReportRowDto[];
  inventoryRows: InventoryReportRowDto[];
  wastageRows: WastageReportRowDto[];
  profitRows: ProfitReportRowDto[];

  canViewProfit: boolean;
}