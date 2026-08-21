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
  saveRecipe,
} from "../actions/recipe-actions";
import type {
  RecipeEditorDataDto,
} from "../types";

interface RecipeEditorFormProps {
  data: RecipeEditorDataDto;
}

interface RecipeRowState {
  key: string;
  inventoryItemId: string;
  quantity: string;
  wastagePercent: string;
  notes: string;
}

function createEmptyRow(
  key: string,
): RecipeRowState {
  return {
    key,
    inventoryItemId: "",
    quantity: "",
    wastagePercent: "0",
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

export function RecipeEditorForm({
  data,
}: RecipeEditorFormProps) {
  const router = useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [name, setName] =
    useState(
      data.recipe?.name ??
        `${data.menuItem.name} Recipe`,
    );

  const [
    description,
    setDescription,
  ] = useState(
    data.recipe?.description ??
      "",
  );

  const [notes, setNotes] =
    useState(
      data.recipe?.notes ?? "",
    );

  const [isActive, setIsActive] =
    useState(
      data.recipe?.isActive ??
        true,
    );

  const [rows, setRows] =
    useState<RecipeRowState[]>(
      data.recipe?.items.length
        ? data.recipe.items.map(
            (item) => ({
              key: item.id,

              inventoryItemId:
                item.inventoryItemId,

              quantity:
                item.quantity.toString(),

              wastagePercent:
                item.wastagePercent.toString(),

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
    name.trim().length > 0 &&
    rows.length > 0 &&
    rows.every((row) => {
      const quantity =
        Number(row.quantity);

      const wastage =
        Number(
          row.wastagePercent,
        );

      return (
        row.inventoryItemId
          .trim().length > 0 &&
        Number.isFinite(
          quantity,
        ) &&
        quantity > 0 &&
        Number.isFinite(
          wastage,
        ) &&
        wastage >= 0 &&
        wastage <= 100
      );
    });

  function updateRow(
    key: string,
    values:
      Partial<RecipeRowState>,
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
          await saveRecipe({
            menuItemId:
              data.menuItem.id,

            name:
              name.trim(),

            description:
              description.trim() ||
              undefined,

            notes:
              notes.trim() ||
              undefined,

            isActive,

            items: rows.map(
              (row) => ({
                inventoryItemId:
                  row.inventoryItemId,

                quantity:
                  Number(
                    row.quantity,
                  ),

                wastagePercent:
                  Number(
                    row.wastagePercent,
                  ),

                notes:
                  row.notes.trim() ||
                  undefined,
              }),
            ),
          });

        if (!result.success) {
          setErrorMessage(
            result.error,
          );

          submittingRef.current =
            false;

          return;
        }

        router.push("/recipes");
        router.refresh();
      } catch (error: unknown) {
        console.error(
          "SAVE_RECIPE_CLIENT_ERROR:",
          error,
        );

        setErrorMessage(
          "The recipe could not be submitted.",
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
          {data.menuItem.name}
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          {
            data.menuItem
              .categoryName
          }
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label
            htmlFor="recipe-name"
            className="text-sm font-medium"
          >
            Recipe Name
          </label>

          <input
            id="recipe-name"
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
            htmlFor="recipe-description"
            className="text-sm font-medium"
          >
            Description
          </label>

          <textarea
            id="recipe-description"
            value={description}
            rows={3}
            maxLength={1_000}
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

        <label className="flex items-center gap-3 rounded-md border p-3">
          <input
            type="checkbox"
            checked={isActive}
            disabled={pending}
            onChange={(event) =>
              setIsActive(
                event.target.checked,
              )
            }
            className="h-4 w-4"
          />

          <span>
            <span className="block text-sm font-medium">
              Active Recipe
            </span>

            <span className="block text-xs text-muted-foreground">
              Active recipes are used
              for inventory deduction.
            </span>
          </span>
        </label>

        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                Ingredients
              </h3>

              <p className="text-sm text-muted-foreground">
                Quantity required for
                one menu item.
              </p>
            </div>

            <button
              type="button"
              onClick={addRow}
              disabled={pending}
              className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add Ingredient
            </button>
          </div>

          <div className="mt-4 space-y-4">
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
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold">
                        Ingredient{" "}
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
                        aria-label="Remove ingredient"
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
                          disabled={
                            pending
                          }
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
                          disabled={
                            pending
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
                          className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`wastage-${row.key}`}
                          className="text-sm font-medium"
                        >
                          Wastage %
                        </label>

                        <input
                          id={`wastage-${row.key}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={
                            row.wastagePercent
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
                                wastagePercent:
                                  event
                                    .target
                                    .value,
                              },
                            )
                          }
                          className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label
                          htmlFor={`notes-${row.key}`}
                          className="text-sm font-medium"
                        >
                          Ingredient Notes
                        </label>

                        <input
                          id={`notes-${row.key}`}
                          value={
                            row.notes
                          }
                          maxLength={500}
                          disabled={
                            pending
                          }
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
                          className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="recipe-notes"
            className="text-sm font-medium"
          >
            Recipe Notes
          </label>

          <textarea
            id="recipe-notes"
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
              Saving Recipe...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Recipe
            </>
          )}
        </button>
      </div>
    </section>
  );
}