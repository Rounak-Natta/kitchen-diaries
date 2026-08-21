"use client";

import {
  ORDER_TAX_RATE_PERCENT,
} from "../constants";
import { useCartStore } from "../store/use-cart";
import type {
  OrderTypeValue,
} from "../types";

import { CartItem } from "./cart-item";
import {
  CreateOrderButton,
} from "./complete-order-button";

export function CartSheet() {
  const items = useCartStore(
    (state) => state.items,
  );

  const orderType = useCartStore(
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

  const setOrderType =
    useCartStore(
      (state) =>
        state.setOrderType,
    );

  const setTableNumber =
    useCartStore(
      (state) =>
        state.setTableNumber,
    );

  const setOrderNotes =
    useCartStore(
      (state) =>
        state.setOrderNotes,
    );

  const subtotal = useCartStore(
    (state) => state.subtotal,
  );

  const tax = useCartStore(
    (state) => state.tax,
  );

  const grandTotal =
    useCartStore(
      (state) =>
        state.grandTotal,
    );

  const totalQuantity =
    items.reduce(
      (total, item) =>
        total + item.quantity,
      0,
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">
          Current Order
        </h2>

        <p className="text-xs text-muted-foreground">
          {totalQuantity} item
          {totalQuantity === 1
            ? ""
            : "s"}
        </p>
      </div>

      <div className="space-y-3 border-b p-4">
        <div>
          <label
            htmlFor="order-type"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Order type
          </label>

          <select
            id="order-type"
            value={orderType}
            onChange={(event) =>
              setOrderType(
                event.target
                  .value as OrderTypeValue,
              )
            }
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="DINE_IN">
              Dine in
            </option>

            <option value="TAKEAWAY">
              Takeaway
            </option>

            <option value="DELIVERY">
              Delivery
            </option>
          </select>
        </div>

        {orderType ===
          "DINE_IN" && (
          <div>
            <label
              htmlFor="table-number"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Table number
            </label>

            <input
              id="table-number"
              value={tableNumber}
              maxLength={30}
              onChange={(event) =>
                setTableNumber(
                  event.target.value,
                )
              }
              placeholder="Example: T-04"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="order-notes"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Order notes
          </label>

          <input
            id="order-notes"
            value={orderNotes}
            maxLength={500}
            onChange={(event) =>
              setOrderNotes(
                event.target.value,
              )
            }
            placeholder="Optional instructions"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm text-muted-foreground">
            Select menu items to
            start an order.
          </div>
        ) : (
          items.map((item) => (
            <CartItem
              key={item.id}
              item={item}
            />
          ))
        )}
      </div>

      <div className="space-y-3 border-t bg-background p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Subtotal
          </span>

          <span>
            ₹
            {subtotal().toFixed(
              2,
            )}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Tax (
            {
              ORDER_TAX_RATE_PERCENT
            }
            %)
          </span>

          <span>
            ₹{tax().toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between border-t pt-3 text-lg font-bold">
          <span>Total</span>

          <span className="text-primary">
            ₹
            {grandTotal().toFixed(
              2,
            )}
          </span>
        </div>

        <CreateOrderButton />
      </div>
    </div>
  );
}