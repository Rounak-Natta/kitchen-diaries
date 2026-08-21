import { getDeviceId } from "./device";
import { allocateNextDocumentNumber } from "./document-ranges";
import { localDb } from "./db";
import { enqueueOutboxOperation } from "./outbox";
import { getLocalSession } from "./session";
import { createLocalEntity, findLocalEntity } from "./repositories";
import { getBusinessDateKey } from "@/lib/business-date";

function dateKey() { return getBusinessDateKey(new Date()); }

export async function createOfflineBill(input: {
  idempotencyKey: string;
  orderId: string; subtotal: number; tax: number; discount: number; total: number;
  customerName?: string | null; customerPhone?: string | null; customerAddress?: string | null;
  notes?: string | null; payment?: { idempotencyKey: string; method: string; tenderedAmount: number; referenceNo?: string };
}) {
  const session = await getLocalSession();
  if (!session) throw new Error("No local session is available.");

  const customerName = input.customerName?.trim() ?? "";
  const customerPhone = input.customerPhone?.trim() ?? "";
  if (customerName.length < 2) throw new Error("Customer name is required.");
  if (!/^\+?[0-9][0-9\s().-]{5,28}[0-9]$/.test(customerPhone)) {
    throw new Error("Enter a valid customer phone number.");
  }

  const order = await findLocalEntity<any>("orders", input.orderId);
  if (!order) throw new Error("Local order was not found.");
  if (order.restaurantId !== session.restaurantId) throw new Error("Local order belongs to another restaurant.");

  const deviceId = session.deviceId || await getDeviceId();
  const number = await allocateNextDocumentNumber(deviceId, "BILL", dateKey());
  const billId = crypto.randomUUID();
  const billNumber = number !== null ? `BILL-${number}` : `OFF-BILL-${Date.now()}`;

  const paymentAmount = Math.min(Math.max(input.payment?.tenderedAmount ?? 0, 0), input.total);
  const dueAmount = Math.max(input.total - paymentAmount, 0);

  await localDb.transaction(
    "rw",
    [
      localDb.bills,
      localDb.payments,
      localDb.orders,
      localDb.orderItems,
      localDb.recipes,
      localDb.recipeItems,
      localDb.inventoryItems,
      localDb.inventoryTransactions,
      localDb.syncOutbox,
    ],
    async () => {
    await createLocalEntity("bills", {
      id: billId, restaurantId: session.restaurantId, version: 1,
      billNumber, idempotencyKey: input.idempotencyKey, orderId: input.orderId, subtotal: input.subtotal, tax: input.tax,
      discount: input.discount, grandTotal: input.total, amountPaid: paymentAmount,
      dueAmount, paymentStatus: dueAmount <= 0 ? "PAID" : paymentAmount > 0 ? "PARTIAL" : "PENDING",
      customerName, customerPhone,
      customerAddress: input.customerAddress?.trim() || null, notes: input.notes?.trim() || null,
    } as never);

    if (input.payment && paymentAmount > 0) {
      await createLocalEntity("payments", {
        id: crypto.randomUUID(), restaurantId: session.restaurantId, version: 1,
        billId, amount: paymentAmount, method: input.payment.method,
        referenceNo: input.payment.referenceNo ?? null,
        idempotencyKey: input.payment.idempotencyKey,
        createdById: session.userId,
      } as never);
    }

    await localDb.orders.update(input.orderId, { status: "BILLED", updatedAt: new Date().toISOString() });

    // Post the same recipe-based stock consumption locally that the server
    // will post atomically with the bill. The deterministic idempotency keys
    // make local retries/reopens safe.
    const orderItems = await localDb.orderItems.where("orderId").equals(input.orderId).toArray();
    for (const orderItem of orderItems) {
      const recipe = await localDb.recipes.where("menuItemId").equals(orderItem.menuItemId).first();
      if (!recipe) continue;

      const recipeItems = await localDb.recipeItems.where("recipeId").equals(recipe.id).toArray();
      for (const recipeItem of recipeItems) {
        const inventoryItem = await localDb.inventoryItems.get(recipeItem.inventoryItemId);
        if (!inventoryItem || inventoryItem.restaurantId !== session.restaurantId) continue;

        const wastagePercent = Number((recipeItem as any).wastagePercent ?? 0);
        const baseQuantity = Number(recipeItem.quantity ?? 0) * Number(orderItem.quantity ?? 0);
        const consumed = Number((baseQuantity * (1 + Math.max(0, wastagePercent) / 100)).toFixed(3));
        if (consumed <= 0) continue;

        const before = Number(inventoryItem.currentStock ?? 0);
        const after = before - consumed;
        if (after < 0 && !inventoryItem.allowNegativeStock) {
          throw new Error(`Insufficient stock for ${inventoryItem.name}.`);
        }

        const idempotencyKey = `bill:${billId}:recipe:${recipeItem.id}:sale`;
        const existingTransaction = await localDb.inventoryTransactions
          .toCollection()
          .filter((transaction) => transaction.idempotencyKey === idempotencyKey)
          .first();
        if (existingTransaction) continue;

        await localDb.inventoryItems.update(inventoryItem.id, {
          currentStock: after,
          version: Number(inventoryItem.version ?? 1) + 1,
          updatedAt: new Date().toISOString(),
        });

        await localDb.inventoryTransactions.put({
          id: crypto.randomUUID(),
          restaurantId: session.restaurantId,
          version: 1,
          inventoryItemId: inventoryItem.id,
          type: "SALE_CONSUMPTION",
          transactionType: "SALE_CONSUMPTION",
          quantity: consumed,
          quantityChange: -consumed,
          stockBefore: before,
          stockAfter: after,
          unit: inventoryItem.unit,
          unitCost: Number(inventoryItem.averageCost ?? 0),
          totalCost: consumed * Number(inventoryItem.averageCost ?? 0),
          reason: `Bill ${billNumber}`,
          referenceType: "BILL",
          referenceId: billId,
          billId,
          orderId: input.orderId,
          idempotencyKey,
          createdById: session.userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as never);
      }
    }

    await localDb.bills.update(billId, {
      inventoryPostedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await enqueueOutboxOperation({
      operationId: crypto.randomUUID(), deviceId, restaurantId: session.restaurantId,
      entityType: "BILL", entityId: billId, operationType: "CREATE",
      payload: {
        _createdAt: new Date().toISOString(),
        _businessDate: dateKey(),
        idempotencyKey: input.idempotencyKey,
        orderId: input.orderId,
        orderIdempotencyKey: typeof order.idempotencyKey === "string" ? order.idempotencyKey : undefined,
        customerName,
        customerPhone,
        customerAddress: input.customerAddress?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        subtotal: input.subtotal,
        tax: input.tax,
        discount: input.discount, grandTotal: input.total, amountPaid: paymentAmount,
        dueAmount, payment: input.payment ? { ...input.payment, tenderedAmount: paymentAmount } : undefined,
      },
    });
  });

  return { billId, billNumber, queued: true, dueAmount };
}

export async function addOfflinePayment(input: {
  billId: string; method: string; tenderedAmount: number; referenceNo?: string; idempotencyKey: string;
}) {
  const session = await getLocalSession();
  if (!session) throw new Error("No local session is available.");
  const bill = await findLocalEntity<any>("bills", input.billId);
  if (!bill) throw new Error("Local bill was not found.");
  if (bill.restaurantId !== session.restaurantId) throw new Error("Local bill belongs to another restaurant.");

  const amount = Math.min(Math.max(input.tenderedAmount, 0), Number(bill.dueAmount));
  if (amount <= 0) throw new Error("No amount is due.");

  const newPaid = Number(bill.amountPaid) + amount;
  const due = Math.max(Number(bill.grandTotal) - newPaid, 0);

  await localDb.transaction("rw", localDb.bills, localDb.payments, localDb.syncOutbox, async () => {
    await localDb.payments.put({
      id: crypto.randomUUID(), restaurantId: session.restaurantId, version: 1,
      billId: bill.id, amount, method: input.method, referenceNo: input.referenceNo ?? null,
      idempotencyKey: input.idempotencyKey, createdById: session.userId,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } as never);
    await localDb.bills.update(bill.id, {
      amountPaid: newPaid, dueAmount: due,
      paymentStatus: due <= 0 ? "PAID" : "PARTIAL",
      version: Number(bill.version ?? 1) + 1,
      updatedAt: new Date().toISOString(),
    });
    await enqueueOutboxOperation({
      operationId: crypto.randomUUID(), deviceId: session.deviceId, restaurantId: session.restaurantId,
      entityType: "BILL", entityId: bill.id, operationType: "ADD_PAYMENT",
      payload: {
        _createdAt: new Date().toISOString(),
        billId: bill.id,
        billIdempotencyKey: typeof bill.idempotencyKey === "string" ? bill.idempotencyKey : undefined,
        method: input.method,
        tenderedAmount: amount,
        referenceNo: input.referenceNo,
        idempotencyKey: input.idempotencyKey,
      },
    });
  });
  return { billId: bill.id, amount, dueAmount: due, queued: true };
}


export async function refundOfflineBill(input: {
  billId: string;
  amount: number;
  method: string;
  reason: string;
  referenceNo?: string;
  notes?: string;
  idempotencyKey: string;
}) {
  const session = await getLocalSession();
  if (!session) throw new Error("No local session is available.");

  const bill = await findLocalEntity<any>("bills", input.billId);
  if (!bill) throw new Error("Local bill was not found.");
  if (bill.restaurantId !== session.restaurantId) throw new Error("Local bill belongs to another restaurant.");

  const refunded = Number(bill.refundedAmount ?? 0);
  const paid = Number(bill.amountPaid ?? 0);
  const refundable = Math.max(paid - refunded, 0);
  if (input.amount <= 0 || input.amount > refundable) {
    throw new Error("Refund amount exceeds the refundable amount.");
  }

  const nextRefunded = Number((refunded + input.amount).toFixed(2));
  const fullyRefunded = nextRefunded >= paid;
  const now = new Date().toISOString();

  await localDb.transaction("rw", localDb.bills, localDb.refunds, localDb.syncOutbox, async () => {
    const refundId = crypto.randomUUID();
    await localDb.refunds.put({
      id: refundId,
      restaurantId: session.restaurantId,
      version: 1,
      billId: bill.id,
      amount: input.amount,
      method: input.method,
      reason: input.reason,
      referenceNo: input.referenceNo ?? null,
      notes: input.notes ?? null,
      idempotencyKey: input.idempotencyKey,
      createdById: session.userId,
      createdAt: now,
      updatedAt: now,
    } as never);

    await localDb.bills.update(bill.id, {
      refundedAmount: nextRefunded,
      status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
      paymentStatus: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
      version: Number(bill.version ?? 1) + 1,
      updatedAt: now,
    });

    await enqueueOutboxOperation({
      operationId: crypto.randomUUID(),
      deviceId: session.deviceId,
      restaurantId: session.restaurantId,
      entityType: "BILL",
      entityId: bill.id,
      operationType: "REFUND",
      payload: {
        _createdAt: now,
        billId: bill.id,
        billIdempotencyKey: typeof bill.idempotencyKey === "string" ? bill.idempotencyKey : undefined,
        idempotencyKey: input.idempotencyKey,
        amount: input.amount,
        method: input.method,
        reason: input.reason,
        referenceNo: input.referenceNo,
        notes: input.notes,
      },
    });
  });

  return {
    billId: bill.id,
    refundedAmount: nextRefunded,
    refundableAmount: Math.max(paid - nextRefunded, 0),
    queued: true,
  };
}

export async function cancelOfflineBill(input: {
  billId: string;
  reason: string;
  idempotencyKey?: string;
}) {
  const session = await getLocalSession();
  if (!session) throw new Error("No local session is available.");
  const bill = await findLocalEntity<any>("bills", input.billId);
  if (!bill) throw new Error("Local bill was not found.");
  if (bill.restaurantId !== session.restaurantId) throw new Error("Local bill belongs to another restaurant.");

  if (Number(bill.amountPaid ?? 0) - Number(bill.refundedAmount ?? 0) > 0) {
    throw new Error("Paid bills cannot be cancelled. Refund the payment instead.");
  }

  const now = new Date().toISOString();
  const order = await findLocalEntity<any>("orders", bill.orderId);

  await localDb.transaction(
    "rw",
    localDb.bills,
    localDb.orders,
    localDb.inventoryItems,
    localDb.inventoryTransactions,
    localDb.syncOutbox,
    async () => {
    await localDb.bills.update(bill.id, {
      status: "CANCELLED",
      paymentStatus: "PENDING",
      dueAmount: 0,
      cancelledAt: now,
      cancellationReason: input.reason,
      version: Number(bill.version ?? 1) + 1,
      updatedAt: now,
    });
    if (order) {
      await localDb.orders.update(order.id, {
        status: "CANCELLED",
        cancelledAt: now,
        cancellationReason: input.reason,
        version: Number(order.version ?? 1) + 1,
        updatedAt: now,
      });
    }

    const saleTransactions = await localDb.inventoryTransactions
      .toCollection()
      .filter((transaction) =>
        transaction.restaurantId === session.restaurantId &&
        transaction.referenceId === bill.id &&
        transaction.transactionType === "SALE_CONSUMPTION"
      )
      .toArray();

    for (const sale of saleTransactions) {
      const reversalKey = `bill:${bill.id}:local-reversal:${sale.id}`;
      const existingReversal = await localDb.inventoryTransactions
        .toCollection()
        .filter((transaction) => transaction.idempotencyKey === reversalKey)
        .first();
      if (existingReversal) continue;

      const inventoryItem = await localDb.inventoryItems.get(sale.inventoryItemId);
      if (!inventoryItem) continue;

      const before = Number(inventoryItem.currentStock ?? 0);
      const restored = Math.abs(Number(sale.quantityChange ?? 0));
      const after = before + restored;

      await localDb.inventoryItems.update(inventoryItem.id, {
        currentStock: after,
        version: Number(inventoryItem.version ?? 1) + 1,
        updatedAt: now,
      });

      await localDb.inventoryTransactions.put({
        id: crypto.randomUUID(),
        restaurantId: session.restaurantId,
        version: 1,
        inventoryItemId: inventoryItem.id,
        type: "REVERSAL",
        transactionType: "REVERSAL",
        quantity: restored,
        quantityChange: restored,
        stockBefore: before,
        stockAfter: after,
        unit: inventoryItem.unit,
        unitCost: Number(inventoryItem.averageCost ?? 0),
        totalCost: restored * Number(inventoryItem.averageCost ?? 0),
        reason: input.reason,
        referenceType: "BILL_CANCELLATION",
        referenceId: bill.id,
        billId: bill.id,
        orderId: bill.orderId,
        idempotencyKey: reversalKey,
        createdById: session.userId,
        createdAt: now,
        updatedAt: now,
      } as never);
    }

    await enqueueOutboxOperation({
      operationId: crypto.randomUUID(),
      deviceId: session.deviceId,
      restaurantId: session.restaurantId,
      entityType: "BILL",
      entityId: bill.id,
      operationType: "CANCEL",
      payload: {
        _createdAt: now,
        billId: bill.id,
        billIdempotencyKey: typeof bill.idempotencyKey === "string" ? bill.idempotencyKey : undefined,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      },
    });
  });

  return { billId: bill.id, cancelled: true, queued: true };
}
