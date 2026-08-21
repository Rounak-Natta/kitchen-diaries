export type PaymentMethodValue =
  | "CASH"
  | "CARD"
  | "UPI"
  | "WALLET"
  | "BANK_TRANSFER";

export type PaymentStatusValue =
  | "PENDING"
  | "PARTIAL"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export type BillStatusValue =
  | "ACTIVE"
  | "CANCELLED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export interface BillingOrderItemDto {
  id: string;
  itemName: string;
  quantity: number;
  totalPrice: number;
  notes: string | null;
  variationName: string | null;

  addons: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

export interface BillingOrderDto {
  id: string;
  orderNumber: string;
  orderType:
    | "DINE_IN"
    | "TAKEAWAY"
    | "DELIVERY";

  tableNumber: string | null;

  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;

  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  serviceCharge: number;
  deliveryCharge: number;
  packagingCharge: number;
  total: number;

  createdAt: string;
  items: BillingOrderItemDto[];
}

export interface BillPaymentDto {
  id: string;
  method: PaymentMethodValue;
  amount: number;
  tenderedAmount: number | null;
  referenceNo: string | null;
  notes: string | null;
  recordedByName: string | null;
  createdAt: string;
}

export interface BillItemDto {
  id: string;
  itemName: string;
  categoryName: string | null;
  quantity: number;
  unitPrice: number;
  addonPrice: number;
  variationPrice: number;
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  netSales: number;
  totalPrice: number;
  notes: string | null;
  variationName: string | null;
  addonNames: string[];
}

export interface BillDetailsDto {
  id: string;
  billNumber: string;
  receiptNumber: string | null;
  status: BillStatusValue;

  orderId: string;
  orderNumber: string;
  orderStatus: string;

  orderType:
    | "DINE_IN"
    | "TAKEAWAY"
    | "DELIVERY";

  tableNumber: string | null;

  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;

  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  serviceCharge: number;
  deliveryCharge: number;
  packagingCharge: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  refundedAmount: number;
  changeReturned: number;
  dueAmount: number;
  paymentStatus: PaymentStatusValue;

  businessDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;

  restaurant: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };

  createdByName: string;

  items: BillItemDto[];
  payments: BillPaymentDto[];
}

export interface BillingHistoryItemDto {
  id: string;
  billNumber: string;
  receiptNumber: string | null;
  orderNumber: string;
  customerName: string | null;
  createdByName: string;
  grandTotal: number;
  amountPaid: number;
  dueAmount: number;
  paymentStatus: PaymentStatusValue;
  status: BillStatusValue;
  createdAt: string;
  paymentMethods: PaymentMethodValue[];
}