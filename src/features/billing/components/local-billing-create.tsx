"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import { BillingForm, type BillingFormOrder } from "./billing-form";
import { localDb, type LocalOrder, type LocalOrderItem } from "@/lib/local-db/db";
import { getLocalSession } from "@/lib/local-db/session";
import { reportUserBug } from "@/components/observability/bug-reporter";

interface LocalBillingCreateProps {
  orderId: string;
}

interface LocalBillingOrder extends BillingFormOrder {
  orderNumber: string;
  orderType: string;
  tableNumber: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    itemName: string;
    quantity: number;
    totalPrice: number;
    notes: string | null;
  }>;
}

function numberValue(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function loadLocalBillingOrder(orderId: string): Promise<LocalBillingOrder | null> {
  const session = await getLocalSession();
  if (!session) return null;

  const order = await localDb.orders.get(orderId) as LocalOrder | undefined;
  if (!order || order.deletedAt || order.restaurantId !== session.restaurantId) {
    return null;
  }

  const items = await localDb.orderItems
    .where("orderId")
    .equals(order.id)
    .filter((item) => item.restaurantId === session.restaurantId && !item.deletedAt)
    .toArray() as LocalOrderItem[];

  return {
    id: order.id,
    serverOrderId: typeof order.serverOrderId === "string" ? order.serverOrderId : null,
    localOnly: true,
    orderNumber: order.orderNumber,
    orderType: stringValue(order.orderType) ?? "ORDER",
    tableNumber: stringValue(order.tableNumber),
    createdAt: order.createdAt,
    subtotal: numberValue(order.subtotal),
    tax: numberValue(order.tax),
    discount: numberValue(order.discount),
    total: numberValue(order.total),
    customerName: stringValue(order.customerName),
    customerPhone: stringValue(order.customerPhone),
    customerAddress: stringValue(order.customerAddress),
    items: items.map((item) => ({
      id: item.id,
      itemName: stringValue(item.itemName) ?? "Item",
      quantity: numberValue(item.quantity),
      totalPrice: numberValue(item.totalPrice),
      notes: stringValue(item.notes),
    })),
  };
}

export function LocalBillingCreate({ orderId }: LocalBillingCreateProps) {
  const [order, setOrder] = useState<LocalBillingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void loadLocalBillingOrder(orderId)
      .then((value) => {
        if (active) setOrder(value);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "The local order database could not be opened.",
          );
        }

        void reportUserBug("CLIENT_RUNTIME", error, {
          action: "LOAD_LOCAL_ORDER_FOR_BILLING",
          orderId,
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/20 p-4 md:p-6">
        <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading local order…
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-muted/20 p-4 md:p-6">
        <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Local billing data needs to finish upgrading</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {loadError}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Close any other Kitchen Diaries tabs on this device, then reload this page. Your local orders are preserved.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex rounded-md border px-4 py-2 text-sm font-medium"
          >
            Reload billing
          </button>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-muted/20 p-4 md:p-6">
        <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Order is not available for billing</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The order is neither available in the cloud nor in this device&apos;s offline database.
          </p>
          <Link href="/orders" className="mt-5 inline-flex rounded-md border px-4 py-2 text-sm font-medium">
            Back to Orders
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/orders" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>

        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">Billing for {order.orderNumber}</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              <WifiOff className="h-3.5 w-3.5" /> Local-first
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.orderType}{order.tableNumber ? ` · Table ${order.tableNumber}` : ""}
            {!order.serverOrderId ? " · Waiting for order sync" : ""}
          </p>
        </div>

        <div className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Order Items</h2>
          <div className="divide-y">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium">{item.itemName}</p>
                  <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                  {item.notes && <p className="mt-1 text-xs italic text-muted-foreground">Note: {item.notes}</p>}
                </div>
                <p className="font-semibold">₹{item.totalPrice.toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{order.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>₹{order.tax.toFixed(2)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-destructive"><span>Discount</span><span>-₹{order.discount.toFixed(2)}</span></div>}
            <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Grand Total</span><span className="text-primary">₹{order.total.toFixed(2)}</span></div>
          </div>
        </div>

        <BillingForm order={order} />
      </div>
    </main>
  );
}
