"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Minus,
  Plus,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  MAX_ORDER_ITEM_QUANTITY,
} from "../constants";
import { useCartStore } from "../store/use-cart";
import type {
  MenuItemDto,
  MenuVariationOptionDto,
} from "../types";

interface VariationModalProps {
  open: boolean;
  onOpenChange: (
    open: boolean,
  ) => void;
  item: MenuItemDto;
}

export function VariationModal({
  open,
  onOpenChange,
  item,
}: VariationModalProps) {
  const addItem = useCartStore(
    (state) => state.addItem,
  );

  const [quantity, setQuantity] =
    useState(1);

  const [notes, setNotes] =
    useState("");

  const [
    selectedVariation,
    setSelectedVariation,
  ] =
    useState<MenuVariationOptionDto | null>(
      null,
    );

  const [
    selectedAddonIds,
    setSelectedAddonIds,
  ] = useState<string[]>([]);

  const variationGroups =
    useMemo(
      () =>
        item.variations.map(
          (variation) =>
            variation.variationGroup,
        ),
      [item.variations],
    );

  const allVariationOptions =
    useMemo(
      () =>
        variationGroups.flatMap(
          (group) =>
            group.options,
        ),
      [variationGroups],
    );

  useEffect(() => {
    if (!open) {
      return;
    }

    const defaultVariation =
      allVariationOptions.find(
        (option) =>
          option.isDefault,
      ) ??
      allVariationOptions[0] ??
      null;

    setQuantity(1);
    setNotes("");
    setSelectedAddonIds([]);
    setSelectedVariation(
      defaultVariation,
    );
  }, [
    open,
    allVariationOptions,
  ]);

  const selectedAddons =
    useMemo(
      () =>
        item.addons
          .map(
            (link) =>
              link.addon,
          )
          .filter((addon) =>
            selectedAddonIds.includes(
              addon.id,
            ),
          ),
      [
        item.addons,
        selectedAddonIds,
      ],
    );

  const addonPrice =
    selectedAddons.reduce(
      (total, addon) =>
        total + addon.price,
      0,
    );

  const variationPrice =
    selectedVariation?.price ?? 0;

  const unitPrice =
    item.price +
    variationPrice +
    addonPrice;

  const lineTotal =
    unitPrice * quantity;

  const toggleAddon = (
    addonId: string,
  ) => {
    setSelectedAddonIds(
      (current) =>
        current.includes(addonId)
          ? current.filter(
              (id) =>
                id !== addonId,
            )
          : [
              ...current,
              addonId,
            ],
    );
  };

  const handleAddToCart = () => {
    addItem({
      menuItemId: item.id,
      name: item.name,

      basePrice: item.price,
      unitPrice,

      quantity,
      notes: notes.trim(),

      variation:
        selectedVariation
          ? {
              id:
                selectedVariation.id,

              name:
                selectedVariation.name,

              price:
                selectedVariation.price,
            }
          : null,

      addons:
        selectedAddons.map(
          (addon) => ({
            id: addon.id,
            name: addon.name,
            price: addon.price,
          }),
        ),
    });

    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-md overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>
            {item.name}
          </DialogTitle>

          <DialogDescription>
            Choose a variation and
            optional add-ons.
          </DialogDescription>

          <p className="text-sm font-semibold text-primary">
            Base price: ₹
            {item.price.toFixed(2)}
          </p>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto p-5">
          {variationGroups.map(
            (group) => (
              <section key={group.id}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.name}
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  {group.options.map(
                    (option) => {
                      const isSelected =
                        selectedVariation?.id ===
                        option.id;

                      return (
                        <button
                          key={
                            option.id
                          }
                          type="button"
                          onClick={() =>
                            setSelectedVariation(
                              option,
                            )
                          }
                          className={`rounded-lg border p-3 text-left text-sm transition ${
                            isSelected
                              ? "border-primary bg-primary/10"
                              : "hover:bg-muted"
                          }`}
                        >
                          <p className="font-medium">
                            {
                              option.name
                            }
                          </p>

                          {option.price !==
                            0 && (
                            <p className="mt-1 text-xs text-primary">
                              {option.price >
                              0
                                ? "+"
                                : "-"}
                              ₹
                              {Math.abs(
                                option.price,
                              ).toFixed(
                                2,
                              )}
                            </p>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>
              </section>
            ),
          )}

          {item.addons.length >
            0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Add-ons
              </h3>

              <div className="space-y-2">
                {item.addons.map(
                  ({ addon }) => {
                    const isSelected =
                      selectedAddonIds.includes(
                        addon.id,
                      );

                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() =>
                          toggleAddon(
                            addon.id,
                          )
                        }
                        className={`flex w-full items-center justify-between rounded-lg border p-3 text-sm transition ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "hover:bg-muted"
                        }`}
                      >
                        <span className="font-medium">
                          {addon.name}
                        </span>

                        <span className="text-primary">
                          +₹
                          {addon.price.toFixed(
                            2,
                          )}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </section>
          )}

          <section>
            <label
              htmlFor={`notes-${item.id}`}
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Item notes
            </label>

            <input
              id={`notes-${item.id}`}
              value={notes}
              maxLength={500}
              onChange={(event) =>
                setNotes(
                  event.target.value,
                )
              }
              placeholder="Special instructions..."
              className="h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-primary"
            />
          </section>
        </div>

        <div className="flex items-center gap-3 border-t p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() =>
                setQuantity(
                  (current) =>
                    Math.max(
                      1,
                      current - 1,
                    ),
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-md border transition hover:bg-muted"
            >
              <Minus className="h-4 w-4" />
            </button>

            <span className="w-8 text-center font-semibold">
              {quantity}
            </span>

            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() =>
                setQuantity(
                  (current) =>
                    Math.min(
                      MAX_ORDER_ITEM_QUANTITY,
                      current + 1,
                    ),
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-md border transition hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={
              handleAddToCart
            }
            className="flex-1 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Add to Cart · ₹
            {lineTotal.toFixed(2)}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}