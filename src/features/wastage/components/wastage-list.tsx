import Link from "next/link";

import type {
  WastageListItemDto,
} from "../types";

interface WastageListProps {
  wastages: WastageListItemDto[];
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

function getStatusClass(
  status: WastageListItemDto["status"],
): string {
  switch (status) {
    case "POSTED":
      return "bg-emerald-50 text-emerald-700";

    case "CANCELLED":
      return "bg-red-50 text-red-700";

    default:
      return "bg-amber-50 text-amber-700";
  }
}

export function WastageList({
  wastages,
}: WastageListProps) {
  if (wastages.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
        No wastage records found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">
                Wastage
              </th>

              <th className="px-4 py-3 font-medium">
                Business Date
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Items
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Cost
              </th>

              <th className="px-4 py-3 font-medium">
                Created By
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
            {wastages.map(
              (wastage) => (
                <tr
                  key={wastage.id}
                  className="hover:bg-muted/20"
                >
                  <td className="px-4 py-4">
                    <p className="font-mono text-xs font-semibold">
                      {wastage.wastageNumber}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(
                        wastage.createdAt,
                      ).toLocaleString(
                        "en-IN",
                        {
                          timeZone:
                            "Asia/Kolkata",
                        },
                      )}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    {wastage.businessDate ??
                      "—"}
                  </td>

                  <td className="px-4 py-4 text-right">
                    {wastage.itemCount}
                  </td>

                  <td className="px-4 py-4 text-right font-semibold">
                    ₹
                    {wastage.totalCost.toFixed(
                      2,
                    )}
                  </td>

                  <td className="px-4 py-4">
                    {wastage.createdByName}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                        wastage.status,
                      )}`}
                    >
                      {formatLabel(
                        wastage.status,
                      )}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/wastage/${wastage.id}`}
                      className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}