import "fake-indexeddb/auto";

import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { localDb } from "./db";
import { saveLocalSession } from "./session";
import { createOfflineOrder } from "./offline-orders";
import { createOfflineBill, refundOfflineBill } from "./offline-billing";
import { createOfflineInventoryTransaction } from "./offline-inventory";

describe("Phase 1 offline POS acceptance", () => {
  beforeEach(async () => {
    if (localDb.isOpen()) localDb.close();
    await Dexie.delete(localDb.name);
    await localDb.open();

    await saveLocalSession({
      userId: "user-1",
      restaurantId: "restaurant-1",
      name: "Owner",
      email: "owner@example.com",
      role: "OWNER",
      deviceId: "device-1",
      authenticatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    await localDb.inventoryItems.put({
      id: "inventory-1",
      restaurantId: "restaurant-1",
      version: 1,
      name: "Rice",
      currentStock: 100,
      allowNegativeStock: false,
      averageCost: 50,
      unit: "KG",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);
  });

  afterEach(() => {
    localDb.close();
  });

  it("keeps ten orders, bills, payment and refund after restart", async () => {
    for (let index = 0; index < 10; index += 1) {
      const order = await createOfflineOrder({
        orderType: "DINE_IN",
        tableNumber: String(index + 1),
        items: [{
          menuItemId: "menu-1",
          itemName: "Test Item",
          quantity: 1,
          basePrice: 100,
          variationPrice: 0,
          addonPrice: 0,
          totalPrice: 100,
        }],
        subtotal: 100,
        taxRate: 5,
        tax: 5,
        total: 105,
        idempotencyKey: crypto.randomUUID(),
      });

      await createOfflineBill({
        idempotencyKey: crypto.randomUUID(),
        orderId: order.id,
        customerName: `Offline Customer ${index + 1}`,
        customerPhone: `987650${String(index).padStart(4, "0")}`,
        subtotal: 100,
        tax: 5,
        discount: 0,
        total: 105,
        payment: {
          idempotencyKey: crypto.randomUUID(),
          method: "CASH",
          tenderedAmount: 105,
        },
      });
    }

    const firstBill = await localDb.bills.orderBy("createdAt").first();
    expect(firstBill).toBeTruthy();

    await refundOfflineBill({
      billId: firstBill!.id,
      amount: 25,
      method: "CASH",
      reason: "Customer refund",
      idempotencyKey: crypto.randomUUID(),
    });

    await createOfflineInventoryTransaction({
      inventoryItemId: "inventory-1",
      type: "STOCK_OUT",
      quantity: 2,
      idempotencyKey: crypto.randomUUID(),
      reason: "Phase 1 test",
    });

    expect(await localDb.orders.count()).toBe(10);
    expect(await localDb.bills.count()).toBe(10);
    expect(await localDb.bills.orderBy("createdAt").first()).toMatchObject({
      customerName: "Offline Customer 1",
      customerPhone: "9876500000",
    });
    expect(await localDb.payments.count()).toBe(10);
    expect(await localDb.refunds.count()).toBe(1);
    expect(await localDb.inventoryTransactions.count()).toBe(1);
    expect(await localDb.syncOutbox.count()).toBe(22);

    localDb.close();
    await localDb.open();

    expect(await localDb.orders.count()).toBe(10);
    expect(await localDb.bills.count()).toBe(10);
    expect(await localDb.bills.orderBy("createdAt").first()).toMatchObject({
      customerName: "Offline Customer 1",
      customerPhone: "9876500000",
    });
    expect(await localDb.payments.count()).toBe(10);
    expect(await localDb.refunds.count()).toBe(1);
    expect(await localDb.inventoryItems.get("inventory-1")).toMatchObject({
      currentStock: 98,
    });
    expect(await localDb.syncOutbox.count()).toBe(22);
  });
});
