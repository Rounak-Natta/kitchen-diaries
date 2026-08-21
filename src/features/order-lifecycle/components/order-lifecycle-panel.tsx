"use client";

import Link from "next/link";
import { Ban, Loader2, ReceiptText, WifiOff } from "lucide-react";
import { useState, useTransition } from "react";

import { cancelOrder, updateOrderLifecycle } from "../actions/order-lifecycle-actions";
import { canCancelOrderStatus, formatOrderStatus, getAllowedManualOrderTransitions } from "../lib/order-state-machine";
import type { OrderLifecycleDto, OrderLifecycleStatus } from "../types";
import { getDeviceId } from "@/lib/local-db/device";
import { getLocalSession } from "@/lib/local-db/session";
import { localDb } from "@/lib/local-db/db";
import { updateLocalEntity } from "@/lib/local-db/repositories";
import { enqueueOutboxOperation } from "@/lib/local-db/outbox";
import { createLocalNotification } from "@/lib/local-db/notifications";
import { runSync } from "@/lib/local-db/sync-bootstrap";

interface OrderLifecyclePanelProps {
  order: OrderLifecycleDto;
  canUpdateStatus: boolean;
  canCancel: boolean;
  offlineMode?: boolean;
  onLocalOrderChanged?: (order: OrderLifecycleDto) => void;
  router?: { refresh: () => void };
}

function localTimestampPatch(status: OrderLifecycleStatus, at: string): Partial<Record<string, unknown>> {
  if (status === "CONFIRMED") return { confirmedAt: at };
  if (status === "PREPARING") return { preparingAt: at };
  if (status === "READY") return { readyAt: at };
  if (status === "CANCELLED") return { cancelledAt: at };
  return {};
}

function notificationCopy(orderNumber: string, status: OrderLifecycleStatus) {
  if (status === "CANCELLED") {
    return { title: "Order cancelled", message: `${orderNumber} was cancelled.` };
  }
  return {
    title: `Order ${formatOrderStatus(status)}`,
    message: `${orderNumber} moved to ${formatOrderStatus(status)}.`,
  };
}

export function OrderLifecyclePanel({
  order,
  canUpdateStatus,
  canCancel,
  offlineMode = false,
  onLocalOrderChanged,
  router,
}: OrderLifecyclePanelProps) {
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const allowedTransitions = getAllowedManualOrderTransitions(order.status);

  async function applyOfflineStatus(targetStatus: OrderLifecycleStatus, reason?: string) {
    const session = await getLocalSession();
    if (!session) throw new Error("No local session is available.");

    const deviceId = session.deviceId || await getDeviceId();
    const changedAt = new Date().toISOString();
    const currentVersion = Number(order.version ?? 1);
    const nextVersion = currentVersion + 1;
    const timestampPatch = localTimestampPatch(targetStatus, changedAt);
    const nextOrder = {
      ...order,
      status: targetStatus,
      version: nextVersion,
      updatedAt: changedAt,
      ...timestampPatch,
      ...(targetStatus === "CANCELLED" ? { cancellationReason: reason ?? null } : {}),
    } as OrderLifecycleDto;

    // updateLocalEntity increments the local version itself. Do not pass
    // `version` in the patch or the version would be incremented twice.
    await updateLocalEntity("orders", order.id, {
      status: targetStatus,
      updatedAt: changedAt,
      ...timestampPatch,
      ...(targetStatus === "CANCELLED"
        ? { cancellationReason: reason ?? null }
        : {}),
    } as never);

    await enqueueOutboxOperation({
      operationId: crypto.randomUUID(),
      deviceId,
      restaurantId: session.restaurantId,
      entityType: "ORDER",
      entityId: order.serverOrderId ?? order.id,
      operationType: "UPDATE",
      baseVersion: currentVersion,
      payload: {
        status: targetStatus,
        idempotencyKey: order.idempotencyKey ?? undefined,
        ...(reason ? { cancellationReason: reason } : {}),
      },
    });

    const copy = notificationCopy(order.orderNumber, targetStatus);
    await createLocalNotification({
      restaurantId: session.restaurantId,
      title: copy.title,
      message: `${copy.message} It will sync when the connection is available.`,
      type: "ORDER_LIFECYCLE",
      dedupeKey: `LOCAL:${order.id}:V${nextVersion}:${targetStatus}`,
      entityType: "ORDER",
      entityId: order.serverOrderId ?? order.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: targetStatus,
    });

    onLocalOrderChanged?.(nextOrder);
  }

  async function applyOnlineStatus(targetStatus: "CONFIRMED" | "PREPARING" | "READY") {
    if (!order.serverOrderId) {
      throw new Error("This order is still syncing. The status change has been queued locally.");
    }

    const serverOrderId = order.serverOrderId;

    const result = await updateOrderLifecycle(serverOrderId, {
      expectedVersion: order.version,
      targetStatus,
    });

    if (!result.success) {
      if (/order was not found/i.test(result.error)) {
        await applyOfflineStatus(targetStatus);
        setSuccessMessage(
          `Saved locally. ${formatOrderStatus(targetStatus)} will sync after the order link is repaired.`,
        );
        void runSync().catch(() => undefined);
        return;
      }

      setErrorMessage(result.error);
      return;
    }

    const changedAt = new Date().toISOString();
    const timestampPatch = localTimestampPatch(targetStatus, changedAt);

    // Keep IndexedDB aligned with the server immediately. This is important
    // because the order screen is intentionally local-first.
    await localDb.orders.update(order.id, {
      status: result.status,
      version: result.version,
      updatedAt: changedAt,
      ...timestampPatch,
    });

    const copy = notificationCopy(order.orderNumber, targetStatus);
    await createLocalNotification({
      restaurantId: (await getLocalSession())?.restaurantId ?? "",
      title: copy.title,
      message: copy.message,
      type: "ORDER_LIFECYCLE",
      dedupeKey: `ORDER:${serverOrderId}:V${result.version}:${targetStatus}`,
      entityType: "ORDER",
      entityId: serverOrderId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: targetStatus,
    });

    onLocalOrderChanged?.({
      ...order,
      status: result.status,
      version: result.version,
      updatedAt: changedAt,
      ...timestampPatch,
    });

    setSuccessMessage(result.message);
    router?.refresh();
  }

  function handleStatusChange(targetStatus: OrderLifecycleStatus) {
    if (pending) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const mustQueueLocally = !navigator.onLine || !order.serverOrderId;

        if (mustQueueLocally) {
          await applyOfflineStatus(targetStatus);
          setSuccessMessage(
            navigator.onLine
              ? `Saved locally. ${formatOrderStatus(targetStatus)} will sync after the order finishes uploading.`
              : `Saved locally. ${formatOrderStatus(targetStatus)} will sync when internet returns.`,
          );
          return;
        }

        await applyOnlineStatus(
          targetStatus as "CONFIRMED" | "PREPARING" | "READY",
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Order update failed.");
      }
    });
  }

  function handleCancel() {
    if (pending || !canCancel) return;

    const reason = window.prompt(`Enter the reason for cancelling ${order.orderNumber}:`);
    if (reason === null) return;

    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3) {
      window.alert("Cancellation reason must contain at least 3 characters.");
      return;
    }

    if (!window.confirm("Cancel this order? This action cannot be reversed from the order screen.")) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const serverOrderId = order.serverOrderId;
        const mustQueueLocally = !navigator.onLine || !serverOrderId;

        if (mustQueueLocally) {
          await applyOfflineStatus("CANCELLED", normalizedReason);
          setSuccessMessage(
            navigator.onLine
              ? "Cancellation saved locally. It will sync after the order finishes uploading."
              : "Cancellation saved locally. It will sync when internet returns.",
          );
          return;
        }

        const result = await cancelOrder(serverOrderId, {
          expectedVersion: order.version,
          reason: normalizedReason,
        });

        if (!result.success) {
          if (/order was not found/i.test(result.error)) {
            await applyOfflineStatus("CANCELLED", normalizedReason);
            setSuccessMessage(
              "Cancellation saved locally. It will sync after the order link is repaired.",
            );
            void runSync().catch(() => undefined);
            return;
          }

          setErrorMessage(result.error);
          return;
        }

        const changedAt = new Date().toISOString();
        await localDb.orders.update(order.id, {
          status: "CANCELLED",
          version: result.version,
          cancelledAt: changedAt,
          cancellationReason: normalizedReason,
          updatedAt: changedAt,
        });

        const session = await getLocalSession();
        if (session) {
          await createLocalNotification({
            restaurantId: session.restaurantId,
            title: "Order cancelled",
            message: `${order.orderNumber} was cancelled.`,
            type: "ORDER_LIFECYCLE",
            dedupeKey: `ORDER:${serverOrderId}:V${result.version}:CANCELLED`,
            entityType: "ORDER",
            entityId: serverOrderId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: "CANCELLED",
          });
        }

        onLocalOrderChanged?.({
          ...order,
          status: "CANCELLED",
          version: result.version,
          cancelledAt: changedAt,
          cancellationReason: normalizedReason,
          updatedAt: changedAt,
        });

        setSuccessMessage(result.message);
        router?.refresh();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Cancellation failed.");
      }
    });
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Next action</p>
          <h2 className="mt-1 text-lg font-semibold">Advance this order</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {offlineMode
              ? "Changes are saved locally first and queued for reliable synchronization."
              : "Move the order one step at a time. Billing controls Billed and Completed."}
          </p>
        </div>

        {offlineMode && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            <WifiOff className="h-3.5 w-3.5" /> Offline
          </span>
        )}
      </div>

      {errorMessage && (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {canUpdateStatus && allowedTransitions.map((status) => (
          <button
            key={status}
            type="button"
            disabled={pending}
            onClick={() => handleStatusChange(status)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Move to {formatOrderStatus(status)}
          </button>
        ))}

        {order.bill && (
          <Link
            href={`/billing/${order.bill.id}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-medium transition hover:bg-muted"
          >
            <ReceiptText className="h-4 w-4" /> Open Bill
          </Link>
        )}

        {canCancel && !order.bill && canCancelOrderStatus(order.status) && (
          <button
            type="button"
            disabled={pending}
            onClick={handleCancel}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-destructive/30 px-5 text-sm font-semibold text-destructive transition hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Ban className="h-4 w-4" /> Cancel Order
          </button>
        )}
      </div>
    </section>
  );
}
