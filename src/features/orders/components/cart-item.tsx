"use client";

import {
  Minus,
  Plus,
  Trash2,
} from "lucide-react";

import { useCartStore } from "../store/use-cart";
import type {
  CartItem as CartItemType,
} from "../types";

interface CartItemProps {
  item: CartItemType;
}

export function CartItem({
  item,
}: CartItemProps) {
  const increaseQuantity =
    useCartStore(
      (state) =>
        state.increaseQuantity,
    );

  const decreaseQuantity =
    useCartStore(
      (state) =>
        state.decreaseQuantity,
    );

  const removeItem =
    useCartStore(
      (state) => state.removeItem,
    );

  const lineTotal =
    item.unitPrice *
    item.quantity;

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {item.name}
          </p>

          {item.variation && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.variation.name}
            </p>
          )}

          {item.addons.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              +{" "}
              {item.addons
                .map(
                  (addon) =>
                    addon.name,
                )
                .join(", ")}
            </p>
          )}

          {item.notes && (
            <p className="mt-1 text-xs italic text-muted-foreground">
              Note: {item.notes}
            </p>
          )}

          <p className="mt-1 text-xs text-muted-foreground">
            ₹
            {item.unitPrice.toFixed(
              2,
            )}{" "}
            each
          </p>
        </div>

        <button
          type="button"
          aria-label={`Remove ${item.name}`}
          onClick={() =>
            removeItem(item.id)
          }
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() =>
              decreaseQuantity(
                item.id,
              )
            }
            className="flex h-8 w-8 items-center justify-center rounded-md border transition hover:bg-muted"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>

          <span className="min-w-6 text-center text-sm font-semibold">
            {item.quantity}
          </span>

          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() =>
              increaseQuantity(
                item.id,
              )
            }
            className="flex h-8 w-8 items-center justify-center rounded-md border transition hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="text-sm font-bold">
          ₹{lineTotal.toFixed(2)}
        </span>
      </div>
    </div>
  );
}