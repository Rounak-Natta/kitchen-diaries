import { create } from "zustand";

import {
  MAX_ORDER_ITEM_QUANTITY,
  ORDER_TAX_RATE_PERCENT,
} from "../constants";
import type {
  CartItem,
  OrderTypeValue,
} from "../types";

type NewCartItem = Omit<
  CartItem,
  "id"
>;

interface CartStore {
  items: CartItem[];

  orderType: OrderTypeValue;
  tableNumber: string;
  orderNotes: string;

  addItem: (
    item: NewCartItem,
  ) => void;

  removeItem: (
    id: string,
  ) => void;

  increaseQuantity: (
    id: string,
  ) => void;

  decreaseQuantity: (
    id: string,
  ) => void;

  setOrderType: (
    orderType: OrderTypeValue,
  ) => void;

  setTableNumber: (
    tableNumber: string,
  ) => void;

  setOrderNotes: (
    orderNotes: string,
  ) => void;

  clearCart: () => void;

  subtotal: () => number;
  tax: () => number;
  grandTotal: () => number;
}

function roundMoney(
  amount: number,
): number {
  return (
    Math.round(
      (amount +
        Number.EPSILON) *
        100,
    ) / 100
  );
}

function getCartItemSignature(
  item: NewCartItem | CartItem,
): string {
  const addonIds = item.addons
    .map((addon) => addon.id)
    .sort()
    .join(",");

  return [
    item.menuItemId,
    item.variation?.id ?? "",
    addonIds,
    item.notes.trim(),
  ].join("|");
}

export const useCartStore =
  create<CartStore>((set, get) => ({
    items: [],

    orderType: "DINE_IN",
    tableNumber: "",
    orderNotes: "",

    addItem: (newItem) =>
      set((state) => {
        const signature =
          getCartItemSignature(
            newItem,
          );

        const existingItem =
          state.items.find(
            (item) =>
              getCartItemSignature(
                item,
              ) === signature,
          );

        if (existingItem) {
          return {
            items: state.items.map(
              (item) =>
                item.id ===
                existingItem.id
                  ? {
                      ...item,

                      quantity:
                        Math.min(
                          item.quantity +
                            newItem.quantity,

                          MAX_ORDER_ITEM_QUANTITY,
                        ),
                    }
                  : item,
            ),
          };
        }

        return {
          items: [
            ...state.items,

            {
              ...newItem,
              id:
                crypto.randomUUID(),
            },
          ],
        };
      }),

    removeItem: (id) =>
      set((state) => ({
        items: state.items.filter(
          (item) =>
            item.id !== id,
        ),
      })),

    increaseQuantity: (id) =>
      set((state) => ({
        items: state.items.map(
          (item) =>
            item.id === id
              ? {
                  ...item,

                  quantity:
                    Math.min(
                      item.quantity + 1,
                      MAX_ORDER_ITEM_QUANTITY,
                    ),
                }
              : item,
        ),
      })),

    decreaseQuantity: (id) =>
      set((state) => ({
        items: state.items
          .map((item) =>
            item.id === id
              ? {
                  ...item,

                  quantity:
                    item.quantity - 1,
                }
              : item,
          )
          .filter(
            (item) =>
              item.quantity > 0,
          ),
      })),

    setOrderType: (orderType) =>
      set({
        orderType,
      }),

    setTableNumber:
      (tableNumber) =>
        set({
          tableNumber,
        }),

    setOrderNotes:
      (orderNotes) =>
        set({
          orderNotes,
        }),

    clearCart: () =>
      set({
        items: [],
        orderType: "DINE_IN",
        tableNumber: "",
        orderNotes: "",
      }),

    subtotal: () =>
      roundMoney(
        get().items.reduce(
          (total, item) =>
            total +
            item.unitPrice *
              item.quantity,
          0,
        ),
      ),

    tax: () =>
      roundMoney(
        get().subtotal() *
          (ORDER_TAX_RATE_PERCENT /
            100),
      ),

    grandTotal: () =>
      roundMoney(
        get().subtotal() +
          get().tax(),
      ),
  }));