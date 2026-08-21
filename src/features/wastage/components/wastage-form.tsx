"use client";

import {
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  useRouter,
} from "next/navigation";

import {
  saveWastageDraft,
} from "../actions/wastage-actions";
import type {
  WastageFormDataDto,
  WastageReasonValue,
} from "../types";

interface WastageFormProps {
  data: WastageFormDataDto;
}

interface WastageRowState {
  key: string;
  inventoryItemId: string;
  quantity: string;
  reason: WastageReasonValue;
  notes: string;
}

const WASTAGE_REASONS: Array<{
  value: WastageReasonValue;
  label: string;
}> = [
  {
    value: "EXPIRED",
    label: "Expired",
  },
  {
    value: "SPOILED",
    label: "Spoiled",
  },
  {
    value: "DAMAGED",
    label: "Damaged",
  },
  {
    value: "PREPARATION_LOSS",
    label: "Preparation Loss",
  },
  {
    value: "COOKING_LOSS",
    label: "Cooking Loss",
  },
  {
    value: "ORDER_CANCELLED",
    label: "Order Cancelled",
  },
  {
    value: "STAFF_MEAL",
    label: "Staff Meal",
  },
  {
    value: "SPILLAGE",
    label: "Spillage",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];

function createEmptyRow(
  key: string,
): WastageRowState {
  return {
    key,
    inventoryItemId: "",
    quantity: "",
    reason: "SPOILED",
    notes: "",
  };
}

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

export function WastageForm({
  data,
}: WastageFormProps) {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [notes, setNotes] =
    useState(
      data.wastage?.notes ??
        "",
    );

  const [rows, setRows] =
    useState<WastageRowState[]>(
      data.wastage?.items.length
        ? data.wastage.items.map(
            (item) => ({
              key: item.id,

              inventoryItemId:
                item.inventoryItemId,

              quantity:
                item.quantity.toString(),

              reason:
                item.reason,

              notes:
                item.notes ?? "",
            }),
          )
        : [
            createEmptyRow(
              "initial-row",
            ),
          ],
    );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const submittingRef =
    useRef(false);

  const isValid =
    rows.length > 0 &&
    rows.every((row) => {
      const quantity =
        Number(row.quantity);

      return (
        row.inventoryItemId
          .trim().length > 0 &&
        Number.isFinite(
          quantity,
        ) &&
        quantity > 0
      );
    });

  function updateRow(
    key: string,
    values:
      Partial<WastageRowState>,
  ): void {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.key === key
          ? {
              ...row,
              ...values,
            }
          : row,
      ),
    );
  }

  function addRow(): void {
    setRows((currentRows) => [
      ...currentRows,

      createEmptyRow(
        crypto.randomUUID(),
      ),
    ]);
  }

  function removeRow(
    key: string,
  ): void {
    setRows((currentRows) =>
      currentRows.filter(
        (row) =>
          row.key !== key,
      ),
    );
  }

  function handleSubmit(): void {
    if (
      pending ||
      submittingRef.current ||
      !isValid
    ) {
      return;
    }

    submittingRef.current =
      true;

    setErrorMessage(null);

    startTransition(async () => {
      try {
        const result =
          await saveWastageDraft(
            data.wastage?.id ??
              null,

            {
              notes:
                notes.trim() ||
                undefined,

              items:
                rows.map(
                  (row) => ({
                    inventoryItemId:
                      row.inventoryItemId,

                    quantity:
                      Number(
                        row.quantity,
                      ),

                    reason:
                      row.reason,

                    notes:
                      row.notes.trim() ||
                      undefined,
                  }),
                ),
            },
          );

        if (!result.success) {
          setErrorMessage(
            result.error,
          );

          submittingRef.current =
            false;

          return;
        }

        router.push(
          `/wastage/${result.wastageId}`,
        );

        router.refresh();
      } catch (error: unknown) {
        console.error(
          "SAVE_WASTAGE_CLIENT_ERROR:",
          error,
        );

        setErrorMessage(
          "The wastage draft could not be saved.",
        );

        submittingRef.current =
          false;
      }
    });
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      {data.wastage && (
        <div className="mb-5 rounded-lg bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">
            Wastage Number
          </p>

          <p className="mt-1 font-mono font-semibold">
            {
              data.wastage
                .wastageNumber
            }
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">
            Wastage Items
          </h2>

          <p className="text-sm text-muted-foreground">
            Add all inventory items
            included in this wastage.
          </p>
        </div>

        <button
          type="button"
          onClick={addRow}
          disabled={pending}
          className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {rows.map(
          (row, index) => {
            const selectedItem =
              data.inventoryItems.find(
                (item) =>
                  item.id ===
                  row.inventoryItemId,
              );

            return (
              <div
                key={row.key}
                className="rounded-lg border p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    Wastage Item{" "}
                    {index + 1}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      removeRow(
                        row.key,
                      )
                    }
                    disabled={
                      pending ||
                      rows.length === 1
                    }
                    className="rounded-md p-2 text-destructive hover:bg-destructive/10 disabled:opacity-30"
                    aria-label="Remove wastage item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label
                      htmlFor={`inventory-${row.key}`}
                      className="text-sm font-medium"
                    >
                      Inventory Item
                    </label>

                    <select
                      id={`inventory-${row.key}`}
                      value={
                        row.inventoryItemId
                      }
                      disabled={pending}
                      onChange={(
                        event,
                      ) =>
                        updateRow(
                          row.key,
                          {
                            inventoryItemId:
                              event
                                .target
                                .value,
                          },
                        )
                      }
                      className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="">
                        Select inventory
                        item
                      </option>

                      {data.inventoryItems.map(
                        (item) => (
                          <option
                            key={
                              item.id
                            }
                            value={
                              item.id
                            }
                          >
                            {item.name} (
                            {item.code})
                          </option>
                        ),
                      )}
                    </select>

                    {selectedItem && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Available:{" "}
                        {
                          selectedItem.currentStock
                        }{" "}
                        {formatLabel(
                          selectedItem.unit,
                        )}
                        {" · "}
                        Average cost: ₹
                        {selectedItem.averageCost.toFixed(
                          4,
                        )}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`quantity-${row.key}`}
                      className="text-sm font-medium"
                    >
                      Quantity
                      {selectedItem
                        ? ` (${formatLabel(
                            selectedItem.unit,
                          )})`
                        : ""}
                    </label>

                    <input
                      id={`quantity-${row.key}`}
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={
                        row.quantity
                      }
                      disabled={pending}
                      onChange={(
                        event,
                      ) =>
                        updateRow(
                          row.key,
                          {
                            quantity:
                              event
                                .target
                                .value,
                          },
                        )
                      }
                      className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`reason-${row.key}`}
                      className="text-sm font-medium"
                    >
                      Reason
                    </label>

                    <select
                      id={`reason-${row.key}`}
                      value={
                        row.reason
                      }
                      disabled={pending}
                      onChange={(
                        event,
                      ) =>
                        updateRow(
                          row.key,
                          {
                            reason:
                              event
                                .target
                                .value as WastageReasonValue,
                          },
                        )
                      }
                      className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    >
                      {WASTAGE_REASONS.map(
                        (reason) => (
                          <option
                            key={
                              reason.value
                            }
                            value={
                              reason.value
                            }
                          >
                            {reason.label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label
                      htmlFor={`item-notes-${row.key}`}
                      className="text-sm font-medium"
                    >
                      Item Notes
                    </label>

                    <input
                      id={`item-notes-${row.key}`}
                      value={
                        row.notes
                      }
                      maxLength={500}
                      disabled={pending}
                      onChange={(
                        event,
                      ) =>
                        updateRow(
                          row.key,
                          {
                            notes:
                              event
                                .target
                                .value,
                          },
                        )
                      }
                      placeholder="Optional"
                      className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            );
          },
        )}
      </div>

      <div className="mt-5">
        <label
          htmlFor="wastage-notes"
          className="text-sm font-medium"
        >
          General Notes
        </label>

        <textarea
          id="wastage-notes"
          value={notes}
          rows={3}
          maxLength={1_000}
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
            Saving Draft...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Save Wastage Draft
          </>
        )}
      </button>
    </section>
  );
}