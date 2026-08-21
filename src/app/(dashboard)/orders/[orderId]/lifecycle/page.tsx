"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowLeft, CloudOff, Loader2, ShieldCheck } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { OrderLifecyclePanel } from "@/features/order-lifecycle/components/order-lifecycle-panel";
import { OrderLifecycleTimeline } from "@/features/order-lifecycle/components/order-lifecycle-timeline";
import { formatOrderStatus } from "@/features/order-lifecycle/lib/order-state-machine";
import type { OrderLifecycleDto } from "@/features/order-lifecycle/types";
import { getLocalSession } from "@/lib/local-db/session";
import { localDb } from "@/lib/local-db/db";
import { hasPermission } from "@/lib/rbac/has-permission";
import { runSync } from "@/lib/local-db/sync-bootstrap";
import { PERMISSIONS } from "@/lib/rbac/permissions";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(value);
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toLifecycleStatus(value: unknown): OrderLifecycleDto["status"] {
  const statuses: OrderLifecycleDto["status"][] = [
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "BILLED",
    "COMPLETED",
    "CANCELLED",
  ];
  return statuses.includes(value as OrderLifecycleDto["status"])
    ? (value as OrderLifecycleDto["status"])
    : "PENDING";
}

async function loadLocalLifecycle(orderId: string): Promise<{
  order: OrderLifecycleDto | null;
  role: string | null;
}> {
  const session = await getLocalSession();
  if (!session) return { order: null, role: null };

  const localOrder = await localDb.orders
    .where("restaurantId")
    .equals(session.restaurantId)
    .filter((candidate) => candidate.id === orderId || candidate.serverOrderId === orderId)
    .first();

  if (!localOrder) {
    return { order: null, role: session.role };
  }

  const localOrderId = localOrder.id;
  const [items, bill] = await Promise.all([
    localDb.orderItems.where("orderId").equals(localOrderId).toArray(),
    localDb.bills.where("orderId").equals(localOrderId).first(),
  ]);

  const updatedAt = localOrder.updatedAt ?? localOrder.createdAt;
  const createdAt = localOrder.createdAt;

  const lifecycle: OrderLifecycleDto = {
    id: localOrder.id,
    serverOrderId: typeof localOrder.serverOrderId === "string" ? localOrder.serverOrderId : null,
    idempotencyKey: typeof localOrder.idempotencyKey === "string" ? localOrder.idempotencyKey : null,
    orderNumber: localOrder.orderNumber,
    status: toLifecycleStatus(localOrder.status),
    inventoryStatus: (localOrder.inventoryStatus as OrderLifecycleDto["inventoryStatus"]) ?? "NOT_DEDUCTED",
    version: Number(localOrder.version ?? 1),
    orderType: String(localOrder.orderType ?? "DINE_IN"),
    tableNumber: typeof localOrder.tableNumber === "string" ? localOrder.tableNumber : null,
    customerName: typeof localOrder.customerName === "string" ? localOrder.customerName : null,
    customerPhone: typeof localOrder.customerPhone === "string" ? localOrder.customerPhone : null,
    total: Number(localOrder.total ?? 0),
    itemCount: items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
    createdByName:
      typeof localOrder.createdByName === "string"
        ? localOrder.createdByName
        : session.name,
    cancelledByName: null,
    confirmedAt: typeof localOrder.confirmedAt === "string" ? localOrder.confirmedAt : null,
    preparingAt: typeof localOrder.preparingAt === "string" ? localOrder.preparingAt : null,
    readyAt: typeof localOrder.readyAt === "string" ? localOrder.readyAt : null,
    billedAt: typeof localOrder.billedAt === "string" ? localOrder.billedAt : null,
    completedAt: typeof localOrder.completedAt === "string" ? localOrder.completedAt : null,
    cancelledAt: typeof localOrder.cancelledAt === "string" ? localOrder.cancelledAt : null,
    cancellationReason: typeof localOrder.cancellationReason === "string" ? localOrder.cancellationReason : null,
    createdAt,
    updatedAt,
    bill: bill
      ? {
          id: bill.id,
          billNumber: bill.billNumber,
          status: String(bill.status ?? "OPEN"),
          paymentStatus: String(bill.paymentStatus ?? "UNPAID"),
          dueAmount: Number(bill.dueAmount ?? 0),
        }
      : null,
  };

  return { order: lifecycle, role: session.role };
}

export default function OrderLifecyclePage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const orderId = params.orderId;

  const [order, setOrder] = useState<OrderLifecycleDto | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const online = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("online", onStoreChange);
      window.addEventListener("offline", onStoreChange);
      return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      if (navigator.onLine) {
        try {
          await runSync();
        } catch {
          // Local data remains the source of truth when the network is unreliable.
        }
      }

      const result = await loadLocalLifecycle(orderId);
      if (!active) return;

      setOrder(result.order);
      setRole(result.role);
      setMissing(!result.order);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [orderId]);

  const canUpdateStatus = useMemo(
    () => hasPermission(role, PERMISSIONS.ORDERS_STATUS_UPDATE),
    [role],
  );
  const canCancel = useMemo(
    () => hasPermission(role, PERMISSIONS.ORDERS_CANCEL),
    [role],
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/20 p-6">
        <div className="mx-auto flex max-w-5xl items-center justify-center rounded-xl border bg-card p-12 shadow-sm">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading order from local database…
        </div>
      </main>
    );
  }

  if (missing || !order) {
    return (
      <main className="min-h-screen bg-muted/20 p-6">
        <div className="mx-auto max-w-5xl rounded-xl border bg-card p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Order not available on this device</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This order is not in the local POS database yet. Reconnect, run sync, and open the order again.
          </p>
          <Link href="/orders" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to Orders
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <div className="flex flex-wrap justify-between gap-3">
            <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Orders
            </Link>
            <Link href="/orders/reconciliation" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <ShieldCheck className="h-4 w-4" /> Reconciliation
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{order.orderNumber}</h1>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {formatOrderStatus(order.status)}
            </span>
            {!online && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <CloudOff className="h-3.5 w-3.5" /> Offline · local data
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {order.serverOrderId ? "Local + server linked" : "Local order · waiting for server sync"} · {formatOrderStatus(order.orderType)}
          </p>
        </header>

        <OrderLifecycleTimeline order={order} />

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Total</p><p className="mt-1 text-lg font-semibold">{formatCurrency(order.total)}</p></div>
            <div><p className="text-xs text-muted-foreground">Items</p><p className="mt-1 text-lg font-semibold">{order.itemCount}</p></div>
            <div><p className="text-xs text-muted-foreground">Table</p><p className="mt-1 font-semibold">{order.tableNumber ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Inventory</p><p className="mt-1 font-semibold">{formatOrderStatus(order.inventoryStatus)}</p></div>
            <div><p className="text-xs text-muted-foreground">Customer</p><p className="mt-1 font-semibold">{order.customerName ?? "Walk-in"}</p></div>
            <div><p className="text-xs text-muted-foreground">Created By</p><p className="mt-1 font-semibold">{order.createdByName}</p></div>
            <div><p className="text-xs text-muted-foreground">Created</p><p className="mt-1 font-semibold">{formatDateTime(order.createdAt)}</p></div>
            <div><p className="text-xs text-muted-foreground">Updated</p><p className="mt-1 font-semibold">{formatDateTime(order.updatedAt)}</p></div>
          </div>
        </section>

        <OrderLifecyclePanel
          order={order}
          canUpdateStatus={canUpdateStatus}
          canCancel={canCancel}
          offlineMode={!online}
          onLocalOrderChanged={setOrder}
          router={router}
        />
      </div>
    </main>
  );
}
