import Link from "next/link";

import type {
  RecipeListItemDto,
} from "../types";

interface RecipeListProps {
  items: RecipeListItemDto[];
  canCreate: boolean;
  canUpdate: boolean;
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

export function RecipeList({
  items,
  canCreate,
  canUpdate,
}: RecipeListProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
        No menu items found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">
                Menu Item
              </th>

              <th className="px-4 py-3 font-medium">
                Inventory Mode
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Ingredients
              </th>

              <th className="px-4 py-3 font-medium">
                Status
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {items.map((item) => {
              const canEdit =
                item.recipe
                  ? canUpdate
                  : canCreate;

              return (
                <tr
                  key={item.menuItemId}
                  className="hover:bg-muted/20"
                >
                  <td className="px-4 py-4">
                    <p className="font-medium">
                      {item.menuItemName}
                    </p>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.categoryName}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    {formatLabel(
                      item.inventoryMode,
                    )}
                  </td>

                  <td className="px-4 py-4 text-right">
                    {item.recipe
                      ?.ingredientCount ??
                      0}
                  </td>

                  <td className="px-4 py-4">
                    {item.recipe ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.recipe
                            .isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.recipe
                          .isActive
                          ? "Active"
                          : "Inactive"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        Not Configured
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-4 text-right">
                    {canEdit ? (
                      <Link
                        href={`/recipes/${item.menuItemId}`}
                        className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted"
                      >
                        {item.recipe
                          ? "Edit Recipe"
                          : "Create Recipe"}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No access
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}