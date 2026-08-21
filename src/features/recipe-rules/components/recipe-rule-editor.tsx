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
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import {
  saveAddonRecipeRules,
  saveVariationRecipeRules,
} from "../actions/recipe-rule-actions";
import type {
  AddonRuleDto,
  RecipeRuleInventoryOptionDto,
  VariationAdjustmentTypeValue,
  VariationRuleDto,
} from "../types";

interface RuleRowState {
  key: string;
  inventoryItemId: string;

  adjustmentType:
    VariationAdjustmentTypeValue;

  quantity: string;
  notes: string;
}

interface RecipeRuleEditorProps {
  mode:
    | "VARIATION"
    | "ADDON";

  entityId: string;
  entityName: string;
  entityDescription: string;

  initialRules:
    | VariationRuleDto[]
    | AddonRuleDto[];

  inventoryItems:
    RecipeRuleInventoryOptionDto[];
}

const ADJUSTMENT_TYPES: Array<{
  value:
    VariationAdjustmentTypeValue;
  label: string;
}> = [
  {
    value: "ADD",
    label: "Add",
  },
  {
    value: "REPLACE",
    label: "Replace Quantity",
  },
  {
    value: "REMOVE",
    label: "Remove Ingredient",
  },
];

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

function isVariationRule(
  rule:
    | VariationRuleDto
    | AddonRuleDto,
): rule is VariationRuleDto {
  return (
    "adjustmentType" in rule
  );
}

export function RecipeRuleEditor({
  mode,
  entityId,
  entityName,
  entityDescription,
  initialRules,
  inventoryItems,
}: RecipeRuleEditorProps) {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [rows, setRows] =
    useState<RuleRowState[]>(
      initialRules.map(
        (rule) => ({
          key: rule.id,

          inventoryItemId:
            rule.inventoryItemId,

          adjustmentType:
            isVariationRule(rule)
              ? rule.adjustmentType
              : "ADD",

          quantity:
            rule.quantity.toString(),

          notes:
            rule.notes ?? "",
        }),
      ),
    );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const submittingRef =
    useRef(false);

  const uniqueInventoryIds =
    new Set(
      rows
        .map(
          (row) =>
            row.inventoryItemId,
        )
        .filter(Boolean),
    );

  const rowsAreValid =
    rows.every((row) => {
      if (
        !row.inventoryItemId
      ) {
        return false;
      }

      if (
        mode === "VARIATION" &&
        row.adjustmentType ===
          "REMOVE"
      ) {
        return true;
      }

      const quantity =
        Number(row.quantity);

      return (
        Number.isFinite(
          quantity,
        ) &&
        quantity > 0
      );
    });

  const isValid =
    rowsAreValid &&
    uniqueInventoryIds.size ===
      rows.length;

  function addRow(): void {
    setRows(
      (currentRows) => [
        ...currentRows,

        {
          key:
            crypto.randomUUID(),

          inventoryItemId:
            "",

          adjustmentType:
            "ADD",

          quantity: "",
          notes: "",
        },
      ],
    );

    setErrorMessage(null);
  }

  function updateRow(
    key: string,
    values:
      Partial<RuleRowState>,
  ): void {
    setRows(
      (currentRows) =>
        currentRows.map(
          (row) =>
            row.key === key
              ? {
                  ...row,
                  ...values,
                }
              : row,
        ),
    );
  }

  function removeRow(
    key: string,
  ): void {
    setRows(
      (currentRows) =>
        currentRows.filter(
          (row) =>
            row.key !== key,
        ),
    );

    setErrorMessage(null);
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
          mode === "VARIATION"
            ? await saveVariationRecipeRules(
                {
                  variationOptionId:
                    entityId,

                  rules:
                    rows.map(
                      (row) => ({
                        inventoryItemId:
                          row.inventoryItemId,

                        adjustmentType:
                          row.adjustmentType,

                        quantity:
                          row.adjustmentType ===
                          "REMOVE"
                            ? 0
                            : Number(
                                row.quantity,
                              ),

                        notes:
                          row.notes.trim() ||
                          undefined,
                      }),
                    ),
                },
              )
            : await saveAddonRecipeRules(
                {
                  addonId:
                    entityId,

                  rules:
                    rows.map(
                      (row) => ({
                        inventoryItemId:
                          row.inventoryItemId,

                        quantity:
                          Number(
                            row.quantity,
                          ),

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
          mode === "VARIATION"
            ? "/recipes/variations"
            : "/recipes/addons",
        );

        router.refresh();
      } catch (error: unknown) {
        console.error(
          "SAVE_RECIPE_RULE_CLIENT_ERROR:",
          error,
        );

        setErrorMessage(
          "Recipe rules could not be submitted.",
        );

        submittingRef.current =
          false;
      }
    });
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-5 rounded-lg bg-muted/40 p-4">
        <p className="font-semibold">
          {entityName}
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          {entityDescription}
        </p>
      </div>

      {mode ===
        "VARIATION" && (
        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p>
            <strong>Add:</strong>{" "}
            increases the base recipe
            quantity.
          </p>

          <p className="mt-1">
            <strong>
              Replace:
            </strong>{" "}
            replaces the base quantity
            for the selected inventory
            item.
          </p>

          <p className="mt-1">
            <strong>
              Remove:
            </strong>{" "}
            removes the selected
            inventory item from the
            recipe.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">
            Ingredient Rules
          </h2>

          <p className="text-sm text-muted-foreground">
            Configure inventory
            consumption per one sold
            unit.
          </p>
        </div>

        <button
          type="button"
          onClick={addRow}
          disabled={pending}
          className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add Ingredient
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No ingredient rules are
            configured. Saving this
            form will clear existing
            rules.
          </div>
        )}

        {rows.map(
          (row, index) => {
            const selectedItem =
              inventoryItems.find(
                (item) =>
                  item.id ===
                  row.inventoryItemId,
              );

            const isRemove =
              mode ===
                "VARIATION" &&
              row.adjustmentType ===
                "REMOVE";

            return (
              <div
                key={row.key}
                className="rounded-lg border p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    Rule {index + 1}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      removeRow(
                        row.key,
                      )
                    }
                    disabled={pending}
                    className="rounded-md p-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    aria-label="Remove rule"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div
                    className={
                      mode ===
                      "ADDON"
                        ? "md:col-span-2"
                        : ""
                    }
                  >
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

                      {inventoryItems.map(
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
                  </div>

                  {mode ===
                    "VARIATION" && (
                    <div>
                      <label
                        htmlFor={`adjustment-${row.key}`}
                        className="text-sm font-medium"
                      >
                        Adjustment
                      </label>

                      <select
                        id={`adjustment-${row.key}`}
                        value={
                          row.adjustmentType
                        }
                        disabled={
                          pending
                        }
                        onChange={(
                          event,
                        ) =>
                          updateRow(
                            row.key,
                            {
                              adjustmentType:
                                event
                                  .target
                                  .value as VariationAdjustmentTypeValue,

                              quantity:
                                event
                                  .target
                                  .value ===
                                "REMOVE"
                                  ? "0"
                                  : row.quantity ===
                                      "0"
                                    ? ""
                                    : row.quantity,
                            },
                          )
                        }
                        className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                      >
                        {ADJUSTMENT_TYPES.map(
                          (option) => (
                            <option
                              key={
                                option.value
                              }
                              value={
                                option.value
                              }
                            >
                              {
                                option.label
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  )}

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
                      min={
                        isRemove
                          ? "0"
                          : "0.001"
                      }
                      step="0.001"
                      value={
                        isRemove
                          ? "0"
                          : row.quantity
                      }
                      disabled={
                        pending ||
                        isRemove
                      }
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
                      className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary disabled:bg-muted"
                    />
                  </div>

                  <div
                    className={
                      mode ===
                      "ADDON"
                        ? ""
                        : ""
                    }
                  >
                    <label
                      htmlFor={`notes-${row.key}`}
                      className="text-sm font-medium"
                    >
                      Notes
                    </label>

                    <input
                      id={`notes-${row.key}`}
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

      {uniqueInventoryIds.size !==
        rows.length && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          The same inventory item
          cannot be added twice.
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
            Saving Rules...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Save Recipe Rules
          </>
        )}
      </button>
    </section>
  );
}