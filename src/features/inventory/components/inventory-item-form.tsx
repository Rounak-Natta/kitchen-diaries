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
  Loader2,
  Save,
} from "lucide-react";

import {
  createInventoryItem,
  updateInventoryItem,
} from "../actions/inventory-item-actions";
import type {
  InventoryItemFormDataDto,
  InventoryItemTypeValue,
  InventoryUnitValue,
} from "../types";

interface InventoryItemFormProps {
  data: InventoryItemFormDataDto;
}

const INVENTORY_TYPES: Array<{
  value: InventoryItemTypeValue;
  label: string;
}> = [
  {
    value: "RAW_MATERIAL",
    label: "Raw Material",
  },
  {
    value:
      "FINISHED_PRODUCT",
    label: "Finished Product",
  },
  {
    value: "PACKAGING",
    label: "Packaging",
  },
  {
    value: "CONSUMABLE",
    label: "Consumable",
  },
];

const INVENTORY_UNITS: Array<{
  value: InventoryUnitValue;
  label: string;
}> = [
  {
    value: "GRAM",
    label: "Gram",
  },
  {
    value: "KILOGRAM",
    label: "Kilogram",
  },
  {
    value: "MILLILITRE",
    label: "Millilitre",
  },
  {
    value: "LITRE",
    label: "Litre",
  },
  {
    value: "PIECE",
    label: "Piece",
  },
  {
    value: "PACKET",
    label: "Packet",
  },
  {
    value: "BOX",
    label: "Box",
  },
  {
    value: "BOTTLE",
    label: "Bottle",
  },
  {
    value: "CAN",
    label: "Can",
  },
  {
    value: "PORTION",
    label: "Portion",
  },
];

function parseNumber(
  value: string,
): number {
  const result =
    Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

export function InventoryItemForm({
  data,
}: InventoryItemFormProps) {
  const router = useRouter();

  const isEditing =
    data.item !== null;

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [name, setName] =
    useState(
      data.item?.name ?? "",
    );

  const [code, setCode] =
    useState(
      data.item?.code ?? "",
    );

  const [barcode, setBarcode] =
    useState(
      data.item?.barcode ?? "",
    );

  const [
    description,
    setDescription,
  ] = useState(
    data.item?.description ??
      "",
  );

  const [type, setType] =
    useState<InventoryItemTypeValue>(
      data.item?.type ??
        "RAW_MATERIAL",
    );

  const [unit, setUnit] =
    useState<InventoryUnitValue>(
      data.item?.unit ??
        "GRAM",
    );

  const [
    categoryId,
    setCategoryId,
  ] = useState(
    data.item?.categoryId ??
      "",
  );

  const [
    minimumStock,
    setMinimumStock,
  ] = useState(
    data.item?.minimumStock.toString() ??
      "0",
  );

  const [
    reorderLevel,
    setReorderLevel,
  ] = useState(
    data.item?.reorderLevel.toString() ??
      "0",
  );

  const [
    openingStock,
    setOpeningStock,
  ] = useState("0");

  const [
    openingUnitCost,
    setOpeningUnitCost,
  ] = useState("");

  const [
    allowNegativeStock,
    setAllowNegativeStock,
  ] = useState(
    data.item
      ?.allowNegativeStock ??
      false,
  );

  const [notes, setNotes] =
    useState(
      data.item?.notes ?? "",
    );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const idempotencyKeyRef =
    useRef<string | null>(null);

  const minimumStockNumber =
    parseNumber(minimumStock);

  const reorderLevelNumber =
    parseNumber(reorderLevel);

  const openingStockNumber =
    parseNumber(openingStock);

  const openingUnitCostNumber =
    openingUnitCost.trim()
      ? parseNumber(
          openingUnitCost,
        )
      : undefined;

  const isValid =
    name.trim().length > 0 &&
    code.trim().length > 0 &&
    minimumStockNumber >= 0 &&
    reorderLevelNumber >= 0 &&
    (isEditing ||
      (openingStockNumber >= 0 &&
        (openingStockNumber ===
          0 ||
          openingUnitCostNumber !==
            undefined)));

  function handleSubmit(): void {
    if (
      pending ||
      !isValid
    ) {
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      try {
        const commonData = {
          name:
            name.trim(),

          code:
            code
              .trim()
              .toUpperCase(),

          barcode:
            barcode.trim() ||
            undefined,

          description:
            description.trim() ||
            undefined,

          type,
          unit,

          categoryId:
            categoryId ||
            undefined,

          minimumStock:
            minimumStockNumber,

          reorderLevel:
            reorderLevelNumber,

          allowNegativeStock,

          notes:
            notes.trim() ||
            undefined,
        };

        const result =
          isEditing &&
          data.item
            ? await updateInventoryItem(
                data.item.id,
                commonData,
              )
            : await createInventoryItem({
                ...commonData,

                idempotencyKey:
                  idempotencyKeyRef
                    .current ??
                  crypto.randomUUID(),

                openingStock:
                  openingStockNumber,

                openingUnitCost:
                  openingUnitCostNumber,
              });

        if (!result.success) {
          setErrorMessage(
            result.error,
          );

          return;
        }

        idempotencyKeyRef.current =
          null;

        router.push(
          "/inventory",
        );

        router.refresh();
      } catch (error: unknown) {
        console.error(
          "SAVE_INVENTORY_ITEM_CLIENT_ERROR:",
          error,
        );

        setErrorMessage(
          "The inventory item could not be submitted.",
        );
      }
    });
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label
            htmlFor="inventory-name"
            className="text-sm font-medium"
          >
            Item Name
          </label>

          <input
            id="inventory-name"
            value={name}
            maxLength={150}
            disabled={pending}
            onChange={(event) =>
              setName(
                event.target.value,
              )
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label
            htmlFor="inventory-code"
            className="text-sm font-medium"
          >
            Item Code
          </label>

          <input
            id="inventory-code"
            value={code}
            maxLength={80}
            disabled={pending}
            onChange={(event) =>
              setCode(
                event.target.value,
              )
            }
            placeholder="Example: TOMATO"
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm uppercase outline-none focus:border-primary"
          />
        </div>

        <div>
          <label
            htmlFor="inventory-type"
            className="text-sm font-medium"
          >
            Item Type
          </label>

          <select
            id="inventory-type"
            value={type}
            disabled={pending}
            onChange={(event) =>
              setType(
                event.target
                  .value as InventoryItemTypeValue,
              )
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {INVENTORY_TYPES.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor="inventory-unit"
            className="text-sm font-medium"
          >
            Measurement Unit
          </label>

          <select
            id="inventory-unit"
            value={unit}
            disabled={pending}
            onChange={(event) =>
              setUnit(
                event.target
                  .value as InventoryUnitValue,
              )
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {INVENTORY_UNITS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor="inventory-category"
            className="text-sm font-medium"
          >
            Category
          </label>

          <select
            id="inventory-category"
            value={categoryId}
            disabled={pending}
            onChange={(event) =>
              setCategoryId(
                event.target.value,
              )
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">
              No category
            </option>

            {data.categories.map(
              (category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor="inventory-barcode"
            className="text-sm font-medium"
          >
            Barcode
          </label>

          <input
            id="inventory-barcode"
            value={barcode}
            maxLength={100}
            disabled={pending}
            onChange={(event) =>
              setBarcode(
                event.target.value,
              )
            }
            placeholder="Optional"
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label
            htmlFor="minimum-stock"
            className="text-sm font-medium"
          >
            Minimum Stock
          </label>

          <input
            id="minimum-stock"
            type="number"
            min="0"
            step="0.001"
            value={minimumStock}
            disabled={pending}
            onChange={(event) =>
              setMinimumStock(
                event.target.value,
              )
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label
            htmlFor="reorder-level"
            className="text-sm font-medium"
          >
            Reorder Level
          </label>

          <input
            id="reorder-level"
            type="number"
            min="0"
            step="0.001"
            value={reorderLevel}
            disabled={pending}
            onChange={(event) =>
              setReorderLevel(
                event.target.value,
              )
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {!isEditing && (
          <>
            <div>
              <label
                htmlFor="opening-stock"
                className="text-sm font-medium"
              >
                Opening Stock
              </label>

              <input
                id="opening-stock"
                type="number"
                min="0"
                step="0.001"
                value={openingStock}
                disabled={pending}
                onChange={(event) =>
                  setOpeningStock(
                    event.target.value,
                  )
                }
                className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label
                htmlFor="opening-unit-cost"
                className="text-sm font-medium"
              >
                Opening Unit Cost
              </label>

              <input
                id="opening-unit-cost"
                type="number"
                min="0"
                step="0.0001"
                value={openingUnitCost}
                disabled={pending}
                onChange={(event) =>
                  setOpeningUnitCost(
                    event.target.value,
                  )
                }
                placeholder={
                  openingStockNumber >
                  0
                    ? "Required"
                    : "Optional"
                }
                className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </>
        )}

        <div className="md:col-span-2">
          <label
            htmlFor="inventory-description"
            className="text-sm font-medium"
          >
            Description
          </label>

          <textarea
            id="inventory-description"
            value={description}
            maxLength={1_000}
            rows={3}
            disabled={pending}
            onChange={(event) =>
              setDescription(
                event.target.value,
              )
            }
            placeholder="Optional"
            className="mt-1 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              checked={
                allowNegativeStock
              }
              disabled={pending}
              onChange={(event) =>
                setAllowNegativeStock(
                  event.target
                    .checked,
                )
              }
              className="h-4 w-4"
            />

            <span>
              <span className="block text-sm font-medium">
                Allow Negative Stock
              </span>

              <span className="block text-xs text-muted-foreground">
                Keep disabled for normal inventory control.
              </span>
            </span>
          </label>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="inventory-notes"
            className="text-sm font-medium"
          >
            Notes
          </label>

          <textarea
            id="inventory-notes"
            value={notes}
            maxLength={1_000}
            rows={3}
            disabled={pending}
            onChange={(event) =>
              setNotes(
                event.target.value,
              )
            }
            placeholder="Optional"
            className="mt-1 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {isEditing &&
        data.item && (
          <div className="mt-5 rounded-md bg-muted/40 p-4 text-sm">
            Current stock:{" "}
            <strong>
              {
                data.item
                  .currentStock
              }
            </strong>
            {" · "}
            Average cost:{" "}
            <strong>
              ₹
              {data.item.averageCost.toFixed(
                4,
              )}
            </strong>

            <p className="mt-1 text-xs text-muted-foreground">
              Use Update Stock to change current quantity.
            </p>
          </div>
        )}

      {errorMessage && (
        <p
          role="alert"
          className="mt-5 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={
          pending ||
          !isValid
        }
        className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            {isEditing
              ? "Update Inventory Item"
              : "Create Inventory Item"}
          </>
        )}
      </button>
    </section>
  );
}