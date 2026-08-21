import type {
  InventoryTransactionDto,
} from "../types";

interface InventoryLedgerTableProps {
  transactions:
    InventoryTransactionDto[];
}

const QUANTITY_FORMATTER =
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

export function InventoryLedgerTable({
  transactions,
}: InventoryLedgerTableProps) {
  if (
    transactions.length === 0
  ) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
        No inventory transactions found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">
                Transaction
              </th>

              <th className="px-4 py-3 font-medium">
                Inventory Item
              </th>

              <th className="px-4 py-3 font-medium">
                Type
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Quantity
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Stock
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Cost
              </th>

              <th className="px-4 py-3 font-medium">
                Reference
              </th>

              <th className="px-4 py-3 font-medium">
                Recorded By
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {transactions.map(
              (transaction) => {
                const isIncoming =
                  transaction.quantityChange >
                  0;

                const reference =
                  transaction.billNumber ??
                  transaction.orderNumber ??
                  transaction.referenceType ??
                  "Manual";

                return (
                  <tr
                    key={transaction.id}
                    className="hover:bg-muted/20"
                  >
                    <td className="px-4 py-4">
                      <p className="font-mono text-xs font-semibold">
                        {
                          transaction.transactionNumber
                        }
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(
                          transaction.createdAt,
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
                      <p className="font-medium">
                        {
                          transaction.inventoryItemName
                        }
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {
                          transaction.inventoryItemCode
                        }
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      {formatLabel(
                        transaction.type,
                      )}
                    </td>

                    <td
                      className={`px-4 py-4 text-right font-semibold ${
                        isIncoming
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      {isIncoming
                        ? "+"
                        : ""}
                      {QUANTITY_FORMATTER.format(
                        transaction.quantityChange,
                      )}{" "}
                      {formatLabel(
                        transaction.unit,
                      )}
                    </td>

                    <td className="px-4 py-4 text-right text-xs">
                      {QUANTITY_FORMATTER.format(
                        transaction.stockBefore,
                      )}
                      {" → "}
                      <span className="font-semibold">
                        {QUANTITY_FORMATTER.format(
                          transaction.stockAfter,
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-right">
                      ₹
                      {transaction.totalCost.toFixed(
                        2,
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <p>{reference}</p>

                      {transaction.reason && (
                        <p className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">
                          {
                            transaction.reason
                          }
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {
                        transaction.createdByName
                      }
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}