"use client";

import {
  useRef,
  useState,
  useTransition,
} from "react";
import {
  useRouter,
} from "next/navigation";
import {
  useQueryClient,
} from "@tanstack/react-query";
import {
  Loader2,
} from "lucide-react";

import {
  createOrder,
} from "../actions/create-order";
import {
  useCartStore,
} from "../store/use-cart";
import { createOfflineOrder } from "@/lib/local-db/offline-orders";
import { runSync } from "@/lib/local-db/sync-bootstrap";
import { reportUserBug } from "@/components/observability/bug-reporter";

export function CreateOrderButton() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  /*
   * The same key is retained while retrying
   * the same submission.
   */
  const idempotencyKeyRef =
    useRef<string | null>(null);

  const items = useCartStore(
    (state) => state.items,
  );

  const orderType =
    useCartStore(
      (state) =>
        state.orderType,
    );

  const tableNumber =
    useCartStore(
      (state) =>
        state.tableNumber,
    );

  const orderNotes =
    useCartStore(
      (state) =>
        state.orderNotes,
    );

  const clearCart =
    useCartStore(
      (state) =>
        state.clearCart,
    );

  const handleCreateOrder = () => {
    if (
      isPending ||
      items.length === 0
    ) {
      return;
    }

    setErrorMessage(null);

    const idempotencyKey =
      idempotencyKeyRef.current ??
      crypto.randomUUID();

    idempotencyKeyRef.current =
      idempotencyKey;

    startTransition(async () => {
      try {
        const orderPayload = {
          idempotencyKey,
          orderType,
          tableNumber: orderType === "DINE_IN" ? tableNumber : undefined,
          notes: orderNotes.trim() || undefined,
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            variationOptionId: item.variation?.id,
            addonIds: item.addons.map((addon) => addon.id),
            notes: item.notes.trim() || undefined,
          })),
        };

        // Offline-first: persist the complete order locally first.
        // The outbox will push it when connectivity returns.
        try {
          await createOfflineOrder({
            orderType,
            tableNumber: orderPayload.tableNumber,
            notes: orderPayload.notes,
            idempotencyKey,
            subtotal: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
            taxRate: 5,
            tax: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 0.05,
            total: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 1.05,
            items: items.map((item) => ({
              menuItemId: item.menuItemId,
              itemName: item.name,
              quantity: item.quantity,
              basePrice: item.basePrice,
              variationPrice: item.variation?.price ?? 0,
              addonPrice: item.addons.reduce((sum, addon) => sum + addon.price, 0),
              totalPrice: item.unitPrice * item.quantity,
              variationOptionId: item.variation?.id,
              addonIds: item.addons.map((addon) => addon.id),
              notes: item.notes.trim() || null,
            })),
          });

          // The order is now safely persisted in IndexedDB and queued in the
          // outbox. Start a sync immediately instead of waiting for the
          // background 60-second interval. A sync failure must not undo the
          // local order; the outbox will retry it later.
          void runSync().catch((syncError: unknown) => {
            console.error("ORDER_SYNC_AFTER_CREATE_ERROR:", syncError);
            void reportUserBug("CLIENT_RUNTIME", syncError, {
              action: "ORDER_SYNC_AFTER_CREATE",
              idempotencyKey,
            });
          });

          idempotencyKeyRef.current = null;
          clearCart();

          // The Orders page uses a TanStack Query cache. Mark it stale before
          // navigating so the page fetches the newest local/server order data
          // immediately instead of showing the previous cached list.
          await queryClient.invalidateQueries({
            queryKey: ["orders"],
            refetchType: "none",
          });

          router.push("/orders");
          router.refresh();
          return;
        } catch {
          // A fresh browser/session without local auth can still use the existing online path.
        }

        const result = await createOrder(orderPayload);
        if (!result.success) {
          setErrorMessage(result.error);
          return;
        }

        idempotencyKeyRef.current = null;
        clearCart();

        // Invalidate the cached Orders query so the redirected page never
        // waits for a manual browser refresh to show the new order.
        await queryClient.invalidateQueries({
          queryKey: ["orders"],
          refetchType: "none",
        });

        router.push("/orders");
        router.refresh();
      } catch (error: unknown) {
        console.error(
          "CREATE_ORDER_CLIENT_ERROR:",
          error,
        );

        void reportUserBug("CLIENT_RUNTIME", error, {
          action: "CREATE_ORDER",
          idempotencyKey,
          orderType,
          itemCount: items.length,
        });

        setErrorMessage(
          "The order could not be submitted. Please try again.",
        );
      }
    });
  };

  return (
    <div className="space-y-2">
      {errorMessage && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={
          handleCreateOrder
        }
        disabled={
          isPending ||
          items.length === 0
        }
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating order...
          </>
        ) : (
          "Create Order"
        )}
      </button>
    </div>
  );
}