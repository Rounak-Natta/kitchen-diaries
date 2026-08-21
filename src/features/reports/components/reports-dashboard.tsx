import Link from "next/link";

import type {
  ReportsDashboardDto,
} from "../types";

interface ReportsDashboardProps {
  data: ReportsDashboardDto;
  canExport: boolean;
}

interface SummaryCardProps {
  label: string;
  value: string;
  description?: string;
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
  maximumFractionDigits = 2,
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

function SummaryCard({
  label,
  value,
  description,
}: SummaryCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold">
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

export function ReportsDashboard({
  data,
  canExport,
}: ReportsDashboardProps) {
  const query =
    new URLSearchParams({
      from: data.range.from,
      to: data.range.to,
    }).toString();

  const exportReports = [
    {
      key: "sales",
      title: "Sales Report",
      description:
        "Bills, net sales, refunds, tax and outstanding amounts.",
    },
    {
      key: "payments",
      title: "Payment Report",
      description:
        "Payments and refunds grouped as financial transactions.",
    },
    {
      key: "inventory",
      title: "Inventory Report",
      description:
        "Current stock, reorder levels and stock status.",
    },
    {
      key: "wastage",
      title: "Wastage Report",
      description:
        "Posted wastage items, reasons, quantities and costs.",
    },
    ...(data.canViewProfit
      ? [
          {
            key: "profit",
            title: "Profit Report",
            description:
              "Item sales, allocated refunds, cost and gross profit.",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <form
          method="get"
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label
              htmlFor="report-from"
              className="text-sm font-medium"
            >
              From
            </label>

            <input
              id="report-from"
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
              htmlFor="report-to"
              className="text-sm font-medium"
            >
              To
            </label>

            <input
              id="report-to"
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
            className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Apply Range
          </button>
        </form>

        <p className="mt-3 text-xs text-muted-foreground">
          {data.range.dayCount}{" "}
          business day
          {data.range.dayCount === 1
            ? ""
            : "s"}{" "}
          selected.
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
        />

        <SummaryCard
          label="Net Collections"
          value={formatCurrency(
            data.summary
              .netCollections,
          )}
        />

        <SummaryCard
          label="Outstanding"
          value={formatCurrency(
            data.summary
              .outstandingAmount,
          )}
        />

        <SummaryCard
          label="Wastage Cost"
          value={formatCurrency(
            data.summary
              .wastageCost,
          )}
        />

        <SummaryCard
          label="Bills"
          value={formatNumber(
            data.summary.billCount,
            0,
          )}
        />

        <SummaryCard
          label="Refunds"
          value={formatCurrency(
            data.summary.refunds,
          )}
        />

        <SummaryCard
          label="Low Stock"
          value={formatNumber(
            data.summary
              .lowStockCount,
            0,
          )}
        />

        <SummaryCard
          label="Out of Stock"
          value={formatNumber(
            data.summary
              .outOfStockCount,
            0,
          )}
        />

        {data.canViewProfit &&
          data.summary.grossProfit !==
            null && (
            <SummaryCard
              label="Gross Profit"
              value={formatCurrency(
                data.summary
                  .grossProfit,
              )}
              description={`${(
                data.summary
                  .grossMarginPercent ??
                0
              ).toFixed(2)}% margin`}
            />
          )}

        {data.canViewProfit &&
          data.summary
            .inventoryValue !==
            null && (
            <SummaryCard
              label="Inventory Value"
              value={formatCurrency(
                data.summary
                  .inventoryValue,
              )}
            />
          )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {exportReports.map(
          (report) => (
            <div
              key={report.key}
              className="rounded-xl border bg-card p-5 shadow-sm"
            >
              <h2 className="font-semibold">
                {report.title}
              </h2>

              <p className="mt-2 min-h-10 text-sm text-muted-foreground">
                {report.description}
              </p>

              {canExport ? (
                <Link
                  href={`/api/reports/${report.key}?${query}`}
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
                >
                  Export CSV
                </Link>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  Export permission is
                  required.
                </p>
              )}
            </div>
          ),
        )}
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <h2 className="font-semibold">
            Recent Sales
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">
                  Bill
                </th>

                <th className="px-4 py-3 font-medium">
                  Date
                </th>

                <th className="px-4 py-3 font-medium">
                  Status
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  Gross
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  Refund
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  Net Sales
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  Due
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {data.salesRows
                .slice(0, 20)
                .map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-4">
                      <Link
                        href={`/billing/${row.id}`}
                        className="font-mono text-xs font-semibold hover:underline"
                      >
                        {row.billNumber}
                      </Link>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.orderNumber}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      {row.businessDate ??
                        "—"}
                    </td>

                    <td className="px-4 py-4">
                      {formatLabel(
                        row.paymentStatus,
                      )}
                    </td>

                    <td className="px-4 py-4 text-right">
                      {formatCurrency(
                        row.grossSales,
                      )}
                    </td>

                    <td className="px-4 py-4 text-right text-amber-700">
                      {formatCurrency(
                        row.refundedAmount,
                      )}
                    </td>

                    <td className="px-4 py-4 text-right font-semibold">
                      {formatCurrency(
                        row.netSales,
                      )}
                    </td>

                    <td className="px-4 py-4 text-right">
                      {formatCurrency(
                        row.dueAmount,
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b p-5">
            <h2 className="font-semibold">
              Recent Transactions
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    Type
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Bill
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Method
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {data.paymentRows
                  .slice(0, 15)
                  .map((row) => (
                    <tr key={`${row.direction}-${row.id}`}>
                      <td className="px-4 py-4">
                        {formatLabel(
                          row.direction,
                        )}
                      </td>

                      <td className="px-4 py-4 font-mono text-xs">
                        {row.billNumber}
                      </td>

                      <td className="px-4 py-4">
                        {formatLabel(
                          row.method,
                        )}
                      </td>

                      <td
                        className={
                          row.direction ===
                          "REFUND"
                            ? "px-4 py-4 text-right font-semibold text-red-600"
                            : "px-4 py-4 text-right font-semibold text-emerald-700"
                        }
                      >
                        {formatCurrency(
                          row.signedAmount,
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b p-5">
            <h2 className="font-semibold">
              Stock Alerts
            </h2>

            <Link
              href="/inventory"
              className="text-sm font-medium text-primary hover:underline"
            >
              Inventory
            </Link>
          </div>

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
                {data.inventoryRows
                  .filter(
                    (row) =>
                      row.status !==
                      "HEALTHY",
                  )
                  .slice(0, 20)
                  .map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-4">
                        <p className="font-medium">
                          {row.name}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {row.code}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-right">
                        {formatNumber(
                          row.currentStock,
                          3,
                        )}{" "}
                        {formatLabel(
                          row.unit,
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {formatLabel(
                          row.status,
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}