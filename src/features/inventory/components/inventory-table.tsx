import Link from "next/link";

import type {
  InventoryItemDto,
} from "../types";

interface InventoryTableProps {
  items: InventoryItemDto[];
  canUpdateStock: boolean;
  canEditItem: boolean;
}

const NUMBER_FORMATTER =
  new Intl.NumberFormat(
    "en-IN",
    {
      maximumFractionDigits: 3,
    },
  );

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

function getStatusClass(
  status:
    InventoryItemDto["stockStatus"],
): string {
  switch (status) {
    case "OUT_OF_STOCK":
      return "bg-red-50 text-red-700";

    case "LOW_STOCK":
      return "bg-amber-50 text-amber-700";

    default:
      return "bg-emerald-50 text-emerald-700";
  }
}

export function InventoryTable({
  items,
  canUpdateStock,
  canEditItem,
}: InventoryTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
        No inventory items found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[950px] text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">
                Item
              </th>

              <th className="px-4 py-3 font-medium">
                Type
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Current Stock
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Reorder Level
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Average Cost
              </th>

              <th className="px-4 py-3 font-medium">
                Status
              </th>

              {(canUpdateStock ||
                canEditItem) && (
                <th className="px-4 py-3 text-right font-medium">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-muted/20"
              >
                <td className="px-4 py-4">
                  <p className="font-medium">
                    {item.name}
                  </p>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.code}
                    {item.categoryName
                      ? ` · ${item.categoryName}`
                      : ""}
                  </p>
                </td>

                <td className="px-4 py-4 text-muted-foreground">
                  {formatLabel(
                    item.type,
                  )}
                </td>

                <td className="px-4 py-4 text-right font-semibold">
                  {NUMBER_FORMATTER.format(
                    item.currentStock,
                  )}{" "}
                  {formatLabel(
                    item.unit,
                  )}
                </td>

                <td className="px-4 py-4 text-right text-muted-foreground">
                  {NUMBER_FORMATTER.format(
                    item.reorderLevel,
                  )}
                </td>

                <td className="px-4 py-4 text-right">
                  ₹
                  {item.averageCost.toFixed(
                    4,
                  )}
                </td>

                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                      item.stockStatus,
                    )}`}
                  >
                    {formatLabel(
                      item.stockStatus,
                    )}
                  </span>
                </td>

                {(canUpdateStock ||
                  canEditItem) && (
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      {canEditItem && (
                        <Link
                          href={`/inventory/${item.id}/edit`}
                          className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted"
                        >
                          Edit
                        </Link>
                      )}

                      {canUpdateStock && (
                        <Link
                          href={`/inventory/${item.id}/adjust`}
                          className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                        >
                          Update Stock
                        </Link>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}