export type OrderLifecycleStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "BILLED"
  | "COMPLETED"
  | "CANCELLED";

export type OrderInventoryStatus =
  | "NOT_DEDUCTED"
  | "DEDUCTED"
  | "PARTIALLY_RESTORED"
  | "RESTORED";

export interface OrderLifecycleDto {
  id: string;
  serverOrderId?: string | null;
  idempotencyKey?: string | null;
  orderNumber: string;

  status: OrderLifecycleStatus;
  inventoryStatus: OrderInventoryStatus;
  version: number;

  orderType: string;
  tableNumber: string | null;

  customerName: string | null;
  customerPhone: string | null;

  total: number;
  itemCount: number;

  createdByName: string;
  cancelledByName: string | null;

  confirmedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  billedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;

  createdAt: string;
  updatedAt: string;

  bill: {
    id: string;
    billNumber: string;
    status: string;
    paymentStatus: string;
    dueAmount: number;
  } | null;
}

export type OrderReconciliationIssueCode =
  | "BILLED_WITHOUT_BILL"
  | "COMPLETED_WITHOUT_BILL"
  | "INVENTORY_WITHOUT_BILL"
  | "ORDER_CANCELLED_WITH_ACTIVE_BILL"
  | "CANCELLED_BILL_ORDER_NOT_CANCELLED"
  | "ORDER_STATUS_MISMATCH"
  | "INVENTORY_POSTING_MISMATCH";

export interface OrderReconciliationIssueDto {
  id: string;
  orderId: string;
  orderNumber: string;

  code: OrderReconciliationIssueCode;

  severity:
    | "HIGH"
    | "MEDIUM";

  message: string;
  repairable: boolean;

  orderStatus: OrderLifecycleStatus;
  inventoryStatus: OrderInventoryStatus;
  version: number;

  billId: string | null;
  billNumber: string | null;
  billStatus: string | null;
  paymentStatus: string | null;

  updatedAt: string;
}