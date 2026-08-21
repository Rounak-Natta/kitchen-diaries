import {
  BillStatus,
  DocumentType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";

import { postBillInventoryConsumption } from "@/features/inventory/services/bill-inventory-consumption-service";
import { restoreCancelledBillInventory } from "@/features/billing-adjustments/services/restore-cancelled-bill-inventory";
import { getBusinessDate } from "@/lib/business-date";
import { nextDocumentNumber } from "@/lib/document-number";
import { writeAuditLog } from "@/lib/audit-log";
import { createBillSchema } from "@/features/billing/validations/billing-schemas";

export interface ProcessCreateBillContext {
  userId: string;
  restaurantId: string;
}

export interface ProcessCreateBillResult {
  billId: string;
  billNumber: string;
  orderId: string;
  orderNumber: string;
}

type MoneyValue = string | number | Prisma.Decimal;

function toMoney(value: MoneyValue): Prisma.Decimal {
  const decimal = new Prisma.Decimal(value);
  if (!decimal.isFinite()) throw new Error("Invalid monetary value.");
  return decimal.toDecimalPlaces(2);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function preparePayment(
  dueAmount: Prisma.Decimal,
  method: PaymentMethod,
  tenderedValue: number,
) {
  if (dueAmount.lte(0)) throw new Error("This bill has no outstanding amount.");

  const tenderedAmount = toMoney(tenderedValue);
  if (tenderedAmount.lte(0)) throw new Error("Payment amount must be greater than zero.");

  if (method !== PaymentMethod.CASH && tenderedAmount.gt(dueAmount)) {
    throw new Error("Non-cash payment cannot exceed the due amount.");
  }

  const appliedAmount = tenderedAmount.gt(dueAmount) ? dueAmount : tenderedAmount;
  const changeReturned = method === PaymentMethod.CASH
    ? tenderedAmount.minus(appliedAmount).toDecimalPlaces(2)
    : toMoney(0);

  return { appliedAmount, tenderedAmount, changeReturned };
}

function allocateAmount(total: Prisma.Decimal, bases: Prisma.Decimal[]): Prisma.Decimal[] {
  if (!bases.length) return [];
  const roundedTotal = total.toDecimalPlaces(2);
  const baseTotal = bases.reduce((sum, value) => sum.plus(value), toMoney(0));
  if (baseTotal.lte(0)) {
    return bases.map((_base, index) => index === bases.length - 1 ? roundedTotal : toMoney(0));
  }

  let allocated = toMoney(0);
  return bases.map((base, index) => {
    if (index === bases.length - 1) return roundedTotal.minus(allocated).toDecimalPlaces(2);
    const share = roundedTotal.mul(base).div(baseTotal).toDecimalPlaces(2);
    allocated = allocated.plus(share);
    return share;
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid bill sync payload.");
  }
  return value as Record<string, unknown>;
}

export async function processCreateBill(
  transaction: Prisma.TransactionClient,
  payload: unknown,
  context: ProcessCreateBillContext,
): Promise<ProcessCreateBillResult> {
  const raw = asRecord(payload);
  const offlineCreatedAt =
    typeof raw._createdAt === "string"
      ? new Date(raw._createdAt)
      : new Date();
  if (Number.isNaN(offlineCreatedAt.getTime())) {
    throw new Error("Invalid offline bill timestamp.");
  }
  const businessDate =
    typeof raw._businessDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw._businessDate)
      ? new Date(`${raw._businessDate}T00:00:00.000Z`)
      : getBusinessDate(offlineCreatedAt);
  if (Number.isNaN(businessDate.getTime())) throw new Error("Invalid offline bill business date.");

  const localOrderId = typeof raw.orderId === "string" ? raw.orderId : "";
  const orderIdempotencyKey = typeof raw.orderIdempotencyKey === "string" ? raw.orderIdempotencyKey : null;

  if (!localOrderId && !orderIdempotencyKey) {
    throw new Error("The offline bill does not contain an order reference.");
  }

  // An offline bill initially references the local UUID. Resolve it to the
  // server order created from the same order idempotency key when necessary.
  let order = localOrderId
    ? await transaction.order.findFirst({
        where: { id: localOrderId, restaurantId: context.restaurantId },
        select: { id: true },
      })
    : null;

  if (!order && orderIdempotencyKey) {
    order = await transaction.order.findFirst({
      where: {
        restaurantId: context.restaurantId,
        idempotencyKey: orderIdempotencyKey,
      },
      select: { id: true },
    });
  }

  if (!order) throw new Error("Order was not found for this restaurant. The order must sync before its bill.");

  const normalizedPayload = {
    idempotencyKey: raw.idempotencyKey,
    orderId: order.id,
    customerName: raw.customerName,
    customerPhone: raw.customerPhone,
    customerAddress: raw.customerAddress,
    notes: raw.notes,
    payment: raw.payment,
  };
  const validation = createBillSchema.safeParse(normalizedPayload);
  if (!validation.success) {
    throw new Error(validation.error.issues[0]?.message ?? "Invalid billing information.");
  }

  const input = validation.data;
  const existingByKey = await transaction.bill.findUnique({
    where: {
      restaurantId_idempotencyKey: {
        restaurantId: context.restaurantId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    select: { id: true, billNumber: true, orderId: true },
  });

  if (existingByKey) {
    if (existingByKey.orderId !== order.id) {
      throw new Error("This idempotency key is already used for another bill.");
    }
    return {
      billId: existingByKey.id,
      billNumber: existingByKey.billNumber,
      orderId: order.id,
      orderNumber: "",
    };
  }

  const existingByOrder = await transaction.bill.findUnique({
    where: { orderId: order.id },
    select: { id: true, billNumber: true },
  });
  if (existingByOrder) {
    const existingOrder = await transaction.order.findUnique({ where: { id: order.id }, select: { orderNumber: true } });
    return {
      billId: existingByOrder.id,
      billNumber: existingByOrder.billNumber,
      orderId: order.id,
      orderNumber: existingOrder?.orderNumber ?? "",
    };
  }

  const fullOrder = await transaction.order.findFirst({
    where: { id: order.id, restaurantId: context.restaurantId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      orderType: true,
      tableNumber: true,
      customerName: true,
      customerPhone: true,
      customerAddress: true,
      subtotal: true,
      taxRate: true,
      tax: true,
      discountType: true,
      discountValue: true,
      discount: true,
      discountReason: true,
      serviceCharge: true,
      deliveryCharge: true,
      packagingCharge: true,
      total: true,
      notes: true,
      items: {
        select: {
          id: true,
          menuItemId: true,
          itemName: true,
          quantity: true,
          basePrice: true,
          variationPrice: true,
          addonPrice: true,
          totalPrice: true,
          notes: true,
          menuItem: { select: { category: { select: { name: true } } } },
          variationOption: { select: { name: true } },
          addons: { select: { addon: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!fullOrder) throw new Error("Order was not found for this restaurant.");
  if (fullOrder.status === OrderStatus.CANCELLED || fullOrder.status === OrderStatus.COMPLETED) {
    throw new Error(`Order cannot be billed while its status is ${fullOrder.status}.`);
  }
  if (!fullOrder.items.length) throw new Error("Cannot bill an empty order.");

  const createdAt = offlineCreatedAt;
  const billNumber = await nextDocumentNumber(transaction, {
    restaurantId: context.restaurantId,
    documentType: DocumentType.BILL,
    businessDate,
  });

  const grandTotal = fullOrder.total.toDecimalPlaces(2);
  const preparedPayment = input.payment
    ? preparePayment(grandTotal, input.payment.method, input.payment.tenderedAmount)
    : null;
  const amountPaid = preparedPayment?.appliedAmount ?? toMoney(0);
  const changeReturned = preparedPayment?.changeReturned ?? toMoney(0);
  const dueAmount = grandTotal.minus(amountPaid).toDecimalPlaces(2);
  const paymentStatus = dueAmount.lte(0)
    ? PaymentStatus.PAID
    : amountPaid.gt(0)
      ? PaymentStatus.PARTIAL
      : PaymentStatus.PENDING;
  const receiptNumber = preparedPayment
    ? await nextDocumentNumber(transaction, {
        restaurantId: context.restaurantId,
        documentType: DocumentType.RECEIPT,
        businessDate,
      })
    : null;

  const grossAmounts = fullOrder.items.map((item) => item.totalPrice.toDecimalPlaces(2));
  const discountAllocations = allocateAmount(fullOrder.discount, grossAmounts);
  const netSalesAmounts = grossAmounts.map((grossAmount, index) =>
    grossAmount.minus(discountAllocations[index] ?? toMoney(0)).toDecimalPlaces(2),
  );
  const taxAllocations = allocateAmount(fullOrder.tax, netSalesAmounts);

  const bill = await transaction.bill.create({
    data: {
      billNumber,
      receiptNumber,
      idempotencyKey: input.idempotencyKey,
      orderId: fullOrder.id,
      restaurantId: context.restaurantId,
      createdById: context.userId,
      orderType: fullOrder.orderType,
      tableNumber: fullOrder.tableNumber,
      customerName: normalizeOptionalText(input.customerName) ?? fullOrder.customerName,
      customerPhone: normalizeOptionalText(input.customerPhone) ?? fullOrder.customerPhone,
      customerAddress: normalizeOptionalText(input.customerAddress) ?? fullOrder.customerAddress,
      subtotal: fullOrder.subtotal,
      taxRate: fullOrder.taxRate,
      tax: fullOrder.tax,
      discountType: fullOrder.discountType,
      discountValue: fullOrder.discountValue,
      discount: fullOrder.discount,
      discountReason: fullOrder.discountReason,
      serviceCharge: fullOrder.serviceCharge,
      deliveryCharge: fullOrder.deliveryCharge,
      packagingCharge: fullOrder.packagingCharge,
      roundOff: toMoney(0),
      grandTotal,
      amountPaid,
      refundedAmount: toMoney(0),
      changeReturned,
      dueAmount,
      paymentStatus,
      businessDate,
      paidAt: paymentStatus === PaymentStatus.PAID ? createdAt : null,
      notes: normalizeOptionalText(input.notes) ?? fullOrder.notes,
      createdAt,
      items: {
        create: fullOrder.items.map((item, index) => {
          const grossAmount = grossAmounts[index] ?? toMoney(0);
          const discountAmount = discountAllocations[index] ?? toMoney(0);
          const netSales = netSalesAmounts[index] ?? toMoney(0);
          const taxAmount = taxAllocations[index] ?? toMoney(0);
          const unitPrice = item.basePrice.plus(item.variationPrice).plus(item.addonPrice).toDecimalPlaces(2);
          return {
            orderItemId: item.id,
            menuItemId: item.menuItemId,
            itemName: item.itemName,
            categoryName: item.menuItem.category.name,
            quantity: item.quantity,
            unitPrice,
            addonPrice: item.addonPrice,
            variationPrice: item.variationPrice,
            grossAmount,
            discountAmount,
            taxAmount,
            netSales,
            totalPrice: netSales.plus(taxAmount).toDecimalPlaces(2),
            costAmount: toMoney(0),
            grossProfit: toMoney(0),
            grossMarginPct: toMoney(0),
            notes: item.notes,
            variationName: item.variationOption?.name ?? null,
            addonNames: item.addons.map((addon) => addon.addon.name),
          };
        }),
      },
      payments: preparedPayment && input.payment
        ? {
            create: {
              idempotencyKey: input.payment.idempotencyKey,
              method: input.payment.method,
              amount: preparedPayment.appliedAmount,
              tenderedAmount: preparedPayment.tenderedAmount,
              referenceNo: normalizeOptionalText(input.payment.referenceNo),
              notes: normalizeOptionalText(input.payment.notes),
              recordedById: context.userId,
              createdAt,
            },
          }
        : undefined,
    },
    select: { id: true, billNumber: true },
  });

  const nextOrderStatus = paymentStatus === PaymentStatus.PAID ? OrderStatus.COMPLETED : OrderStatus.BILLED;
  await transaction.order.update({
    where: { id: fullOrder.id },
    data: {
      status: nextOrderStatus,
      billedAt: createdAt,
      completedAt: nextOrderStatus === OrderStatus.COMPLETED ? createdAt : null,
      version: { increment: 1 },
    },
  });

  const inventoryResult = await postBillInventoryConsumption(transaction, {
    restaurantId: context.restaurantId,
    createdById: context.userId,
    billId: bill.id,
    businessDate,
  });

  await writeAuditLog(transaction, {
    restaurantId: context.restaurantId,
    userId: context.userId,
    module: "BILLING",
    action: "CREATE_BILL",
    entityType: "Bill",
    entityId: bill.id,
    newData: {
      billNumber: bill.billNumber,
      receiptNumber,
      orderId: fullOrder.id,
      orderNumber: fullOrder.orderNumber,
      grandTotal: grandTotal.toString(),
      amountPaid: amountPaid.toString(),
      dueAmount: dueAmount.toString(),
      changeReturned: changeReturned.toString(),
      paymentStatus,
      paymentMethod: input.payment?.method ?? null,
      inventoryPosted: !inventoryResult.alreadyPosted,
      inventoryTransactionCount: inventoryResult.transactionCount,
      inventoryCost: inventoryResult.totalCost.toString(),
      businessDate: businessDate.toISOString().slice(0, 10),
      source: "OFFLINE_SYNC",
    },
  });

  return {
    billId: bill.id,
    billNumber: bill.billNumber,
    orderId: fullOrder.id,
    orderNumber: fullOrder.orderNumber,
  };
}

export interface ProcessAddPaymentContext {
  userId: string;
  restaurantId: string;
}

export async function processAddPayment(
  transaction: Prisma.TransactionClient,
  payload: unknown,
  context: ProcessAddPaymentContext,
): Promise<{ billId: string; amount: string; dueAmount: string }> {
  const raw = asRecord(payload);
  const paymentCreatedAt =
    typeof raw._createdAt === "string"
      ? new Date(raw._createdAt)
      : new Date();
  if (Number.isNaN(paymentCreatedAt.getTime())) {
    throw new Error("Invalid offline payment timestamp.");
  }
  const billId = typeof raw.billId === "string" ? raw.billId : "";
  const billIdempotencyKey = typeof raw.billIdempotencyKey === "string" ? raw.billIdempotencyKey : null;

  if (!billId && !billIdempotencyKey) throw new Error("The offline payment does not contain a bill reference.");

  let bill = billId
    ? await transaction.bill.findFirst({
        where: { id: billId, restaurantId: context.restaurantId },
        select: { id: true, grandTotal: true, amountPaid: true, dueAmount: true, paymentStatus: true, orderId: true },
      })
    : null;

  if (!bill && billIdempotencyKey) {
    bill = await transaction.bill.findFirst({
      where: { restaurantId: context.restaurantId, idempotencyKey: billIdempotencyKey },
      select: { id: true, grandTotal: true, amountPaid: true, dueAmount: true, paymentStatus: true, orderId: true },
    });
  }

  if (!bill) throw new Error("Bill was not found for this restaurant.");

  const paymentKey = typeof raw.idempotencyKey === "string" ? raw.idempotencyKey : "";
  const method = typeof raw.method === "string" ? raw.method : "";
  const tenderedAmount = typeof raw.tenderedAmount === "number" ? raw.tenderedAmount : Number(raw.tenderedAmount);
  if (!paymentKey || !method || !Number.isFinite(tenderedAmount) || tenderedAmount <= 0) {
    throw new Error("Invalid payment information.");
  }

  const paymentMethod = PaymentMethod[method as keyof typeof PaymentMethod];
  if (!paymentMethod) throw new Error("Invalid payment method.");

  const existingPayment = await transaction.billPayment.findUnique({
    where: { billId_idempotencyKey: { billId: bill.id, idempotencyKey: paymentKey } },
    select: { id: true },
  });
  if (existingPayment) {
    return {
      billId: bill.id,
      amount: "0.00",
      dueAmount: Number(bill.dueAmount).toFixed(2),
    };
  }

  const currentDue = toMoney(bill.dueAmount);
  if (currentDue.lte(0)) throw new Error("This bill has no outstanding amount.");

  const tendered = toMoney(tenderedAmount);
  if (paymentMethod !== PaymentMethod.CASH && tendered.gt(currentDue)) {
    throw new Error("Non-cash payment cannot exceed the due amount.");
  }

  const appliedAmount = tendered.gt(currentDue) ? currentDue : tendered;
  const changeReturned = paymentMethod === PaymentMethod.CASH
    ? tendered.minus(appliedAmount).toDecimalPlaces(2)
    : toMoney(0);
  const newAmountPaid = toMoney(bill.amountPaid).plus(appliedAmount).toDecimalPlaces(2);
  const newDueAmount = toMoney(bill.grandTotal).minus(newAmountPaid).toDecimalPlaces(2);
  const newStatus = newDueAmount.lte(0) ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
  const now = paymentCreatedAt;

  await transaction.billPayment.create({
    data: {
      billId: bill.id,
      idempotencyKey: paymentKey,
      method: paymentMethod,
      amount: appliedAmount,
      tenderedAmount: tendered,
      referenceNo: typeof raw.referenceNo === "string" ? normalizeOptionalText(raw.referenceNo) : null,
      recordedById: context.userId,
      createdAt: now,
    },
  });

  await transaction.bill.update({
    where: { id: bill.id },
    data: {
      amountPaid: newAmountPaid,
      dueAmount: newDueAmount,
      paymentStatus: newStatus,
      changeReturned: { increment: changeReturned },
      paidAt: newStatus === PaymentStatus.PAID ? now : null,
    },
  });

  await transaction.order.update({
    where: { id: bill.orderId },
    data: {
      status: newStatus === PaymentStatus.PAID ? OrderStatus.COMPLETED : OrderStatus.BILLED,
      completedAt: newStatus === PaymentStatus.PAID ? now : null,
      version: { increment: 1 },
    },
  });

  await writeAuditLog(transaction, {
    restaurantId: context.restaurantId,
    userId: context.userId,
    module: "BILLING",
    action: "ADD_PAYMENT",
    entityType: "Bill",
    entityId: bill.id,
    newData: {
      paymentIdempotencyKey: paymentKey,
      amount: appliedAmount.toString(),
      method: paymentMethod,
      dueAmount: newDueAmount.toString(),
      paymentStatus: newStatus,
      source: "OFFLINE_SYNC",
    },
  });

  return {
    billId: bill.id,
    amount: appliedAmount.toString(),
    dueAmount: newDueAmount.toString(),
  };
}


export async function processRefundBill(
  transaction: Prisma.TransactionClient,
  payload: unknown,
  context: ProcessCreateBillContext,
): Promise<{ refundId: string; refundNumber: string; refundedAmount: string; refundableAmount: string }> {
  const raw = asRecord(payload);
  const refundCreatedAt =
    typeof raw._createdAt === "string"
      ? new Date(raw._createdAt)
      : new Date();
  if (Number.isNaN(refundCreatedAt.getTime())) {
    throw new Error("Invalid offline refund timestamp.");
  }
  const billId = typeof raw.billId === "string" ? raw.billId : "";
  const billIdempotencyKey = typeof raw.billIdempotencyKey === "string" ? raw.billIdempotencyKey : null;
  const idempotencyKey = typeof raw.idempotencyKey === "string" ? raw.idempotencyKey : "";
  const amount = typeof raw.amount === "number" || typeof raw.amount === "string" ? toMoney(raw.amount as MoneyValue) : null;
  const method = typeof raw.method === "string" ? raw.method : "";
  const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";

  if ((!billId && !billIdempotencyKey) || !idempotencyKey || !amount || amount.lte(0) || !method || reason.length < 3) {
    throw new Error("Invalid refund information.");
  }

  const paymentMethod = PaymentMethod[method as keyof typeof PaymentMethod];
  if (!paymentMethod) throw new Error("Invalid refund method.");

  let bill = billId
    ? await transaction.bill.findFirst({
        where: { id: billId, restaurantId: context.restaurantId },
        select: { id: true, billNumber: true, status: true, amountPaid: true, refundedAmount: true, dueAmount: true, paymentStatus: true },
      })
    : null;

  if (!bill && billIdempotencyKey) {
    bill = await transaction.bill.findFirst({
      where: { restaurantId: context.restaurantId, idempotencyKey: billIdempotencyKey },
      select: { id: true, billNumber: true, status: true, amountPaid: true, refundedAmount: true, dueAmount: true, paymentStatus: true },
    });
  }

  if (!bill) throw new Error("Bill was not found for this restaurant.");

  const existing = await transaction.billRefund.findUnique({
    where: { billId_idempotencyKey: { billId: bill.id, idempotencyKey } },
    select: { id: true, refundNumber: true },
  });
  if (existing) {
    const refundable = bill.amountPaid.minus(bill.refundedAmount).toDecimalPlaces(2);
    return {
      refundId: existing.id,
      refundNumber: existing.refundNumber,
      refundedAmount: bill.refundedAmount.toString(),
      refundableAmount: refundable.toString(),
    };
  }

  if (bill.status === BillStatus.CANCELLED || bill.status === BillStatus.REFUNDED) {
    throw new Error("Bill is already fully refunded or cancelled.");
  }

  if (
    bill.dueAmount.gt(0) ||
    (bill.paymentStatus !== PaymentStatus.PAID &&
      bill.paymentStatus !== PaymentStatus.PARTIALLY_REFUNDED)
  ) {
    throw new Error("Only fully paid bills can be refunded.");
  }

  const refundable = bill.amountPaid.minus(bill.refundedAmount).toDecimalPlaces(2);
  if (amount.gt(refundable)) {
    throw new Error(`Refund amount cannot exceed the refundable amount of ₹${refundable.toString()}.`);
  }

  const createdAt = refundCreatedAt;
  const refundNumber = await nextDocumentNumber(transaction, {
    restaurantId: context.restaurantId,
    documentType: DocumentType.REFUND,
    businessDate: getBusinessDate(createdAt),
  });

  const refund = await transaction.billRefund.create({
    data: {
      refundNumber,
      billId: bill.id,
      idempotencyKey,
      amount,
      method: paymentMethod,
      reason,
      referenceNo: typeof raw.referenceNo === "string" ? normalizeOptionalText(raw.referenceNo) : null,
      notes: typeof raw.notes === "string" ? normalizeOptionalText(raw.notes) : null,
      createdById: context.userId,
      createdAt,
    },
    select: { id: true, refundNumber: true },
  });

  const refundedAmount = bill.refundedAmount.plus(amount).toDecimalPlaces(2);
  const refundableAmount = bill.amountPaid.minus(refundedAmount).toDecimalPlaces(2);
  const fullyRefunded = refundableAmount.lte(0);

  await transaction.bill.update({
    where: { id: bill.id },
    data: {
      refundedAmount,
      status: fullyRefunded ? BillStatus.REFUNDED : BillStatus.PARTIALLY_REFUNDED,
      paymentStatus: fullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
    },
  });

  await writeAuditLog(transaction, {
    restaurantId: context.restaurantId,
    userId: context.userId,
    module: "BILLING",
    action: "CREATE_REFUND",
    entityType: "BillRefund",
    entityId: refund.id,
    newData: {
      billId: bill.id,
      billNumber: bill.billNumber,
      refundNumber,
      refundAmount: amount.toString(),
      refundedAmount: refundedAmount.toString(),
      refundableAmount: refundableAmount.toString(),
      refundMethod: paymentMethod,
      reason,
      source: "OFFLINE_SYNC",
    },
    reason,
  });

  return {
    refundId: refund.id,
    refundNumber,
    refundedAmount: refundedAmount.toString(),
    refundableAmount: refundableAmount.toString(),
  };
}

export async function processCancelBill(
  transaction: Prisma.TransactionClient,
  payload: unknown,
  context: ProcessCreateBillContext,
): Promise<{ billId: string; status: string }> {
  const raw = asRecord(payload);
  const billId = typeof raw.billId === "string" ? raw.billId : "";
  const billIdempotencyKey = typeof raw.billIdempotencyKey === "string" ? raw.billIdempotencyKey : null;
  const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
  if ((!billId && !billIdempotencyKey) || reason.length < 3) {
    throw new Error("Invalid cancellation information.");
  }

  let bill = billId
    ? await transaction.bill.findFirst({
        where: { id: billId, restaurantId: context.restaurantId },
        select: {
          id: true, status: true, orderId: true, amountPaid: true, refundedAmount: true,
          dueAmount: true, paymentStatus: true,
          order: { select: { inventoryStatus: true } },
        },
      })
    : null;
  if (!bill && billIdempotencyKey) {
    bill = await transaction.bill.findFirst({
      where: { restaurantId: context.restaurantId, idempotencyKey: billIdempotencyKey },
      select: {
        id: true, status: true, orderId: true, amountPaid: true, refundedAmount: true,
        dueAmount: true, paymentStatus: true,
        order: { select: { inventoryStatus: true } },
      },
    });
  }
  if (!bill) throw new Error("Bill was not found.");
  if (bill.status === BillStatus.CANCELLED) return { billId: bill.id, status: "CANCELLED" };
  if (bill.status === BillStatus.REFUNDED || bill.status === BillStatus.PARTIALLY_REFUNDED) {
    throw new Error("Refunded bills cannot be cancelled.");
  }
  if (bill.amountPaid.minus(bill.refundedAmount).gt(0)) {
    throw new Error("Paid bills cannot be cancelled. Refund the payment instead.");
  }

  const createdAt =
    typeof raw._createdAt === "string"
      ? new Date(raw._createdAt)
      : new Date();
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error("Invalid offline cancellation timestamp.");
  }
  const businessDate =
    typeof raw._businessDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw._businessDate)
      ? new Date(`${raw._businessDate}T00:00:00.000Z`)
      : getBusinessDate(createdAt);
  const inventoryResult = await restoreCancelledBillInventory(transaction, {
    restaurantId: context.restaurantId,
    createdById: context.userId,
    billId: bill.id,
    businessDate,
    reason,
  });

  await transaction.bill.update({
    where: { id: bill.id },
    data: {
      status: BillStatus.CANCELLED,
      dueAmount: toMoney(0),
      paymentStatus: PaymentStatus.PENDING,
      paidAt: null,
      cancelledAt: createdAt,
      cancellationReason: reason,
      cancelledById: context.userId,
    },
  });
  await transaction.order.update({
    where: { id: bill.orderId },
    data: {
      status: OrderStatus.CANCELLED,
      inventoryStatus: inventoryResult.inventoryStatus,
      cancelledAt: createdAt,
      cancellationReason: reason,
      cancelledById: context.userId,
      completedAt: null,
      version: { increment: 1 },
    },
  });

  await writeAuditLog(transaction, {
    restaurantId: context.restaurantId,
    userId: context.userId,
    module: "BILLING",
    action: "CANCEL_BILL",
    entityType: "Bill",
    entityId: bill.id,
    newData: {
      status: BillStatus.CANCELLED,
      reason,
      restoredInventoryTransactions: inventoryResult.restoredTransactionCount,
      source: "OFFLINE_SYNC",
    },
    reason,
  });

  return { billId: bill.id, status: "CANCELLED" };
}
