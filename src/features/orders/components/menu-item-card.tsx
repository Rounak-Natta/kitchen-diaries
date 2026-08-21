"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { useCartStore } from "../store/use-cart";
import type {
  MenuItemDto,
} from "../types";

import {
  VariationModal,
} from "./variation-modal";

interface MenuItemCardProps {
  item: MenuItemDto;
}

export function MenuItemCard({
  item,
}: MenuItemCardProps) {
  const [isOpen, setIsOpen] =
    useState(false);

  const addItem = useCartStore(
    (state) => state.addItem,
  );

  const hasVariations =
    item.variations.some(
      (variation) =>
        variation
          .variationGroup.options
          .length > 0,
    );

  const hasAddons =
    item.addons.length > 0;

  const handleAdd = () => {
    if (
      hasVariations ||
      hasAddons
    ) {
      setIsOpen(true);
      return;
    }

    addItem({
      menuItemId: item.id,
      name: item.name,

      basePrice: item.price,
      unitPrice: item.price,

      quantity: 1,
      notes: "",

      variation: null,
      addons: [],
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleAdd}
        className="group flex min-h-24 flex-col items-start justify-between gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
      >
        <div className="flex w-full items-start justify-between gap-2">
          <span className="line-clamp-2 text-sm font-semibold">
            {item.name}
          </span>

          <Plus className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
        </div>

        <span className="text-sm font-bold text-primary">
          ₹{item.price.toFixed(2)}
        </span>
      </button>

      <VariationModal
        open={isOpen}
        onOpenChange={setIsOpen}
        item={item}
      />
    </>
  );
}