import Link from "next/link";

import type {
  AnalyticsDashboardDto,
} from "../types";

interface AnalyticsDashboardProps {
  data: AnalyticsDashboardDto;
}

interface SummaryCardProps {
  label: string;
  value: string;
  description?: string;
  valueClassName?: string;
}

function SummaryCard({
  label,
  value,
  description,
  valueClassName = "",
}: SummaryCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${valueClassName}`}
      >
        {value}
      </p>

      {description && (
        <p className="mt-1 text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatNumber(
  value: number,
  maximumFractionDigits = 3,
): string {
  return new Intl.NumberFormat(
    "en-IN",
    {
      maximumFractionDigits,
    },
  ).format(value);
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

export function AnalyticsDashboard({
  data,
}: AnalyticsDashboardProps) {
  const maximumDailySales =
    Math.max(
      1,
      ...data.dailySales.map(
        (entry) =>
          entry.netSales,
      ),
    );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <form
          method="get"
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label
              htmlFor="analytics-from"
              className="text-sm font-medium"
            >
              From
            </label>

            <input
              id="analytics-from"
              name="from"
              type="date"
              defaultValue={
                data.range.from
              }
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex-1">
            <label
              htmlFor="analytics-to"
              className="text-sm font-medium"
            >
              To
            </label>

            <input
              id="analytics-to"
              name="to"
              type="date"
              defaultValue={
                data.range.to
              }
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Apply Range
          </button>
        </form>

        <p className="mt-3 text-xs text-muted-foreground">
          Showing{" "}
          {data.range.dayCount}{" "}
          business day
          {data.range.dayCount ===
          1
            ? ""
            : "s"}{" "}
          from {data.range.from} to{" "}
          {data.range.to}.
        </p>

        {data.range.warning && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {data.range.warning}
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Net Sales"
          value={formatCurrency(
            data.summary.netSales,
          )}
          description="Gross sales less refunds"
          valueClassName="text-emerald-700"
        />

        <SummaryCard
          label="Net Collections"
          value={formatCurrency(
            data.summary
              .netCollections,
          )}
          description="Payments received less refunds"
        />

        <SummaryCard
          label="Bills"
          value={formatNumber(
            data.summary.billCount,
            0,
          )}
          description={`Average ${formatCurrency(
            data.summary
              .averageBillValue,
          )}`}
        />

        <SummaryCard
          label="Outstanding"
          value={formatCurrency(
            data.summary
              .outstandingAmount,
          )}
          valueClassName={
            data.summary
              .outstandingAmount > 0
              ? "text-red-600"
              : "text-emerald-700"
          }
        />

        <SummaryCard
          label="Gross Sales"
          value={formatCurrency(
            data.summary.grossSales,
          )}
        />

        <SummaryCard
          label="Refunds"
          value={formatCurrency(
            data.summary.refunds,
          )}
          valueClassName="text-amber-700"
        />

        <SummaryCard
          label="Tax"
          value={formatCurrency(
            data.summary.taxAmount,
          )}
        />

        <SummaryCard
          label="Discounts"
          value={formatCurrency(
            data.summary
              .discountAmount,
          )}
        />

        {data.canViewProfit &&
          data.summary
            .costOfGoodsSold !==
            null && (
            <SummaryCard
              label="Cost of Goods"
              value={formatCurrency(
                data.summary
                  .costOfGoodsSold,
              )}
            />
          )}

        {data.canViewProfit &&
          data.summary.grossProfit !==
            null && (
            <SummaryCard
              label="Gross Profit"
              value={formatCurrency(
                data.summary
                  .grossProfit,
              )}
              description={
                data.summary
                  .grossMarginPercent !==
                null
                  ? `${data.summary.grossMarginPercent.toFixed(
                      2,
                    )}% margin`
                  : undefined
              }
              valueClassName={
                data.summary
                  .grossProfit >= 0
                  ? "text-emerald-700"
                  : "text-red-600"
              }
            />
          )}

        <SummaryCard
          label="Wastage Cost"
          value={formatCurrency(
            data.summary
              .wastageCost,
          )}
          valueClassName="text-red-600"
        />

        {data.canViewProfit &&
          data.summary
            .inventoryValue !==
            null && (
            <SummaryCard
              label="Current Inventory Value"
              value={formatCurrency(
                data.summary
                  .inventoryValue,
              )}
            />
          )}
      </section>

      <section className="rounded-xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <h2 className="font-semibold">
            Daily Sales
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Sales are grouped by
            restaurant business date.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">
                  Business Date
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  Bills
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  Gross Sales
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  Refunds
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  Net Sales
                </th>

                {data.canViewProfit && (
                  <>
                    <th className="px-4 py-3 text-right font-medium">
                      COGS
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Gross Profit
                    </th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y">
              {data.dailySales.map(
                (entry) => (
                  <tr
                    key={
                      entry.businessDate
                    }
                    className="hover:bg-muted/20"
                  >
                    <td className="px-4 py-4">
                      <p className="font-medium">
                        {
                          entry.businessDate
                        }
                      </p>

                      <div className="mt-2 h-1.5 w-36 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.max(
                              entry.netSales >
                                0
                                ? 3
                                : 0,
                              (
                                entry.netSales /
                                maximumDailySales
                              ) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </td>

                    <td className="px-4 py-4 text-right">
                      {entry.billCount}
                    </td>

                    <td className="px-4 py-4 text-right">
                      {formatCurrency(
                        entry.grossSales,
                      )}
                    </td>

                    <td className="px-4 py-4 text-right text-amber-700">
                      {formatCurrency(
                        entry.refunds,
                      )}
                    </td>

                    <td className="px-4 py-4 text-right font-semibold">
                      {formatCurrency(
                        entry.netSales,
                      )}
                    </td>

                    {data.canViewProfit && (
                      <>
                        <td className="px-4 py-4 text-right">
                          {formatCurrency(
                            entry.costOfGoodsSold ??
                              0,
                          )}
                        </td>

                        <td className="px-4 py-4 text-right font-semibold">
                          {formatCurrency(
                            entry.grossProfit ??
                              0,
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b p-5">
            <h2 className="font-semibold">
              Top Selling Items
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Ranked by billed item
              net sales before
              bill-level refunds.
            </p>
          </div>

          {data.topSellingItems
            .length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No sales found for this
              period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      Item
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Quantity
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Sales
                    </th>

                    {data.canViewProfit && (
                      <th className="px-4 py-3 text-right font-medium">
                        Profit
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {data.topSellingItems.map(
                    (item) => (
                      <tr
                        key={item.key}
                      >
                        <td className="px-4 py-4">
                          <p className="font-medium">
                            {
                              item.itemName
                            }
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {
                              item.categoryName
                            }
                          </p>
                        </td>

                        <td className="px-4 py-4 text-right">
                          {formatNumber(
                            item.quantity,
                            0,
                          )}
                        </td>

                        <td className="px-4 py-4 text-right font-semibold">
                          {formatCurrency(
                            item.billedNetSales,
                          )}
                        </td>

                        {data.canViewProfit && (
                          <td className="px-4 py-4 text-right">
                            {formatCurrency(
                              item.grossProfit ??
                                0,
                            )}
                          </td>
                        )}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b p-5">
            <h2 className="font-semibold">
              Payment Methods
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Gross payments received
              before refunds.
            </p>
          </div>

          {data.paymentMethods
            .length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No payments found for
              this period.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    Method
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    Transactions
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {data.paymentMethods.map(
                  (method) => (
                    <tr
                      key={
                        method.method
                      }
                    >
                      <td className="px-4 py-4 font-medium">
                        {formatLabel(
                          method.method,
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        {
                          method.transactionCount
                        }
                      </td>

                      <td className="px-4 py-4 text-right font-semibold">
                        {formatCurrency(
                          method.amount,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b p-5">
            <h2 className="font-semibold">
              Wastage by Reason
            </h2>
          </div>

          {data.wastageReasons
            .length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No posted wastage found
              for this period.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    Reason
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    Entries
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    Cost
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {data.wastageReasons.map(
                  (reason) => (
                    <tr
                      key={
                        reason.reason
                      }
                    >
                      <td className="px-4 py-4 font-medium">
                        {formatLabel(
                          reason.reason,
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        {
                          reason.itemCount
                        }
                      </td>

                      <td className="px-4 py-4 text-right font-semibold text-red-600">
                        {formatCurrency(
                          reason.totalCost,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h2 className="font-semibold">
                Low Stock
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Current inventory
                snapshot.
              </p>
            </div>

            <Link
              href="/inventory"
              className="text-sm font-medium text-primary hover:underline"
            >
              Open Inventory
            </Link>
          </div>

          {data.lowStockItems
            .length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No low-stock items.
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-muted text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      Item
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Stock
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {data.lowStockItems.map(
                    (item) => (
                      <tr
                        key={item.id}
                      >
                        <td className="px-4 py-4">
                          <p className="font-medium">
                            {item.name}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {item.code}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-right">
                          {formatNumber(
                            item.currentStock,
                          )}{" "}
                          {formatLabel(
                            item.unit,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={
                              item.status ===
                              "OUT_OF_STOCK"
                                ? "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
                                : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                            }
                          >
                            {formatLabel(
                              item.status,
                            )}
                          </span>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}