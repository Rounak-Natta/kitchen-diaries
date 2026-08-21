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
  createManualInventoryTransaction,
} from "../actions/inventory-actions";
import { createOfflineInventoryTransaction } from "@/lib/local-db/offline-inventory";
import type {
  InventoryItemDto,
  ManualInventoryTransactionType,
} from "../types";

interface InventoryAdjustmentFormProps {
  item: InventoryItemDto;

  allowedTypes:
    ManualInventoryTransactionType[];
}

const TRANSACTION_LABELS: Record<
  ManualInventoryTransactionType,
  string
> = {
  STOCK_IN: "Stock In",
  STOCK_OUT: "Stock Out",
  ADJUSTMENT_IN:
    "Adjustment In",
  ADJUSTMENT_OUT:
    "Adjustment Out",
};

function formatLabel(
  value: string,
): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export function InventoryAdjustmentForm({
  item,
  allowedTypes,
}: InventoryAdjustmentFormProps) {
  const router = useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [type, setType] =
    useState<ManualInventoryTransactionType>(
      allowedTypes[0] ??
        "STOCK_IN",
    );

  const [quantity, setQuantity] =
    useState("");

  const [unitCost, setUnitCost] =
    useState(
      item.averageCost > 0
        ? item.averageCost.toFixed(
            4,
          )
        : "",
    );

  const [reason, setReason] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const idempotencyKeyRef =
    useRef<string | null>(null);

  const quantityNumber =
    Number(quantity);

  const unitCostNumber =
    unitCost.trim()
      ? Number(unitCost)
      : undefined;

  const isIncoming =
    type === "STOCK_IN" ||
    type === "ADJUSTMENT_IN";

  const requiresReason =
    type === "ADJUSTMENT_IN" ||
    type === "ADJUSTMENT_OUT";

  const isValid =
    Number.isFinite(
      quantityNumber,
    ) &&
    quantityNumber > 0 &&
    (!requiresReason ||
      reason.trim().length > 0) &&
    (!isIncoming ||
      unitCostNumber ===
        undefined ||
      (Number.isFinite(
        unitCostNumber,
      ) &&
        unitCostNumber >= 0));

  function handleSubmit(): void {
    if (
      pending ||
      !isValid
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
        try {
          await createOfflineInventoryTransaction({
            idempotencyKey,
            inventoryItemId: item.id,
            type,
            quantity: quantityNumber,
            unitCost: isIncoming ? unitCostNumber : undefined,
            reason: reason.trim() || undefined,
          });
          idempotencyKeyRef.current = null;
          router.push("/inventory/transactions");
          router.refresh();
          return;
        } catch {
          // Fall back to the existing server action.
        }

        const result = await createManualInventoryTransaction({
          idempotencyKey,
          inventoryItemId: item.id,
          type,
          quantity: quantityNumber,
          unitCost: isIncoming ? unitCostNumber : undefined,
          reason: reason.trim() || undefined,
        });

        if (!result.success) {
          setErrorMessage(result.error);
          return;
        }

        idempotencyKeyRef.current = null;
        router.push("/inventory/transactions");
        router.refresh();
      } catch (error: unknown) {
        console.error(
          "MANUAL_INVENTORY_CLIENT_ERROR:",
          error,
        );

        setErrorMessage(
          "The stock update could not be submitted.",
        );
      }
    });
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-5 rounded-lg bg-muted/40 p-4">
        <p className="font-semibold">
          {item.name}
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          {item.code} · Current
          stock:{" "}
          {item.currentStock}{" "}
          {formatLabel(item.unit)}
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label
            htmlFor="transaction-type"
            className="text-sm font-medium"
          >
            Transaction Type
          </label>

          <select
            id="transaction-type"
            value={type}
            disabled={pending}
            onChange={(event) => {
              setType(
                event.target
                  .value as ManualInventoryTransactionType,
              );

              setErrorMessage(
                null,
              );
            }}
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {allowedTypes.map(
              (allowedType) => (
                <option
                  key={
                    allowedType
                  }
                  value={
                    allowedType
                  }
                >
                  {
                    TRANSACTION_LABELS[
                      allowedType
                    ]
                  }
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor="inventory-quantity"
            className="text-sm font-medium"
          >
            Quantity (
            {formatLabel(
              item.unit,
            )}
            )
          </label>

          <input
            id="inventory-quantity"
            type="number"
            min="0.001"
            step="0.001"
            value={quantity}
            disabled={pending}
            onChange={(event) =>
              setQuantity(
                event.target.value,
              )
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {isIncoming && (
          <div>
            <label
              htmlFor="inventory-unit-cost"
              className="text-sm font-medium"
            >
              Unit Cost
            </label>

            <input
              id="inventory-unit-cost"
              type="number"
              min="0"
              step="0.0001"
              value={unitCost}
              disabled={pending}
              onChange={(event) =>
                setUnitCost(
                  event.target.value,
                )
              }
              placeholder="Optional"
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            />

            <p className="mt-1 text-xs text-muted-foreground">
              Leave blank to retain
              the existing average
              cost.
            </p>
          </div>
        )}

        <div>
          <label
            htmlFor="inventory-reason"
            className="text-sm font-medium"
          >
            Reason
            {requiresReason
              ? " *"
              : ""}
          </label>

          <textarea
            id="inventory-reason"
            value={reason}
            rows={3}
            maxLength={500}
            disabled={pending}
            onChange={(event) =>
              setReason(
                event.target.value,
              )
            }
            placeholder={
              requiresReason
                ? "Reason is required"
                : "Optional note"
            }
            className="mt-1 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating Stock...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Stock Update
            </>
          )}
        </button>
      </div>
    </section>
  );
}