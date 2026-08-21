import Link from "next/link";

import {
  formatOrderStatus,
} from "../lib/order-state-machine";
import type {
  OrderReconciliationIssueDto,
} from "../types";
import {
  OrderReconcileButton,
} from "./order-reconcile-button";

interface OrderReconciliationTableProps {
  issues:
    OrderReconciliationIssueDto[];

  canRepair: boolean;
}

function formatDateTime(
  value: string,
): string {
  return new Date(
    value,
  ).toLocaleString(
    "en-IN",
    {
      timeZone:
        "Asia/Kolkata",

      dateStyle:
        "medium",

      timeStyle:
        "short",
    },
  );
}

export function OrderReconciliationTable({
  issues,
  canRepair,
}: OrderReconciliationTableProps) {
  if (
    issues.length === 0
  ) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <h2 className="font-semibold text-emerald-800">
          No lifecycle issues found
        </h2>

        <p className="mt-2 text-sm text-emerald-700">
          The most recent 500 orders
          are consistent with billing
          and inventory state.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b p-5">
        <h2 className="font-semibold">
          Lifecycle Issues
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Automatic repair is only
          available when the active
          bill provides an
          authoritative status.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">
                Severity
              </th>

              <th className="px-4 py-3 font-medium">
                Order
              </th>

              <th className="px-4 py-3 font-medium">
                Issue
              </th>

              <th className="px-4 py-3 font-medium">
                Order State
              </th>

              <th className="px-4 py-3 font-medium">
                Bill State
              </th>

              <th className="px-4 py-3 font-medium">
                Updated
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {issues.map(
              (issue) => (
                <tr
                  key={issue.id}
                  className="align-top hover:bg-muted/20"
                >
                  <td className="px-4 py-4">
                    <span
                      className={
                        issue.severity ===
                        "HIGH"
                          ? "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
                          : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                      }
                    >
                      {issue.severity}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <Link
                      href={`/orders/${issue.orderId}/lifecycle`}
                      className="font-mono text-xs font-semibold hover:underline"
                    >
                      {issue.orderNumber}
                    </Link>
                  </td>

                  <td className="max-w-96 px-4 py-4">
                    <p className="font-medium">
                      {formatOrderStatus(
                        issue.code,
                      )}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {issue.message}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    <p className="font-medium">
                      {formatOrderStatus(
                        issue.orderStatus,
                      )}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Inventory:{" "}
                      {formatOrderStatus(
                        issue.inventoryStatus,
                      )}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    {issue.billId ? (
                      <>
                        <Link
                          href={`/billing/${issue.billId}`}
                          className="font-mono text-xs font-semibold hover:underline"
                        >
                          {issue.billNumber}
                        </Link>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatOrderStatus(
                            issue.billStatus ??
                              "",
                          )}
                          {" · "}
                          {formatOrderStatus(
                            issue.paymentStatus ??
                              "",
                          )}
                        </p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        No bill
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                    {formatDateTime(
                      issue.updatedAt,
                    )}
                  </td>

                  <td className="px-4 py-4 text-right">
                    {canRepair &&
                    issue.repairable ? (
                      <OrderReconcileButton
                        orderId={
                          issue.orderId
                        }
                        orderNumber={
                          issue.orderNumber
                        }
                        expectedVersion={
                          issue.version
                        }
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Manual review
                      </span>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}