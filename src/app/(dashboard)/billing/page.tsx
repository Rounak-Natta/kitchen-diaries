import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import {
  getBillingHistory,
} from "@/features/billing/queries/billing-queries";
import { getAuthUser } from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

function getPaymentStatusClass(
  status: string,
): string {
  switch (status) {
    case "PAID":
      return "bg-emerald-50 text-emerald-700";

    case "PARTIAL":
      return "bg-amber-50 text-amber-700";

    case "REFUNDED":
      return "bg-purple-50 text-purple-700";

    case "PARTIALLY_REFUNDED":
      return "bg-violet-50 text-violet-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default async function BillingHistoryPage() {
  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.ORDERS_READ,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  const bills =
    await getBillingHistory(
      user.restaurantId,
    );

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            Billing
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Recent bills and
            payment status.
          </p>
        </div>

        <div className="space-y-3">
          {bills.map((bill) => (
            <Link
              key={bill.id}
              href={`/billing/${bill.id}`}
              className="flex flex-col justify-between gap-4 rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-mono text-base font-semibold">
                    {
                      bill.billNumber
                    }
                  </h2>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getPaymentStatusClass(
                      bill.paymentStatus,
                    )}`}
                  >
                    {
                      bill.paymentStatus
                    }
                  </span>

                  {bill.status !==
                    "ACTIVE" && (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                      {
                        bill.status
                      }
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    Order{" "}
                    {
                      bill.orderNumber
                    }
                  </span>

                  <span>
                    {bill.customerName ??
                      "Walk-in customer"}
                  </span>

                  <span>
                    {
                      bill.createdByName
                    }
                  </span>

                  <span>
                    {new Date(
                      bill.createdAt,
                    ).toLocaleString(
                      "en-IN",
                      {
                        timeZone:
                          "Asia/Kolkata",
                      },
                    )}
                  </span>
                </div>

                {bill.paymentMethods
                  .length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bill.paymentMethods.map(
                      (method) => (
                        <span
                          key={
                            method
                          }
                          className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                        >
                          {
                            method
                          }
                        </span>
                      ),
                    )}
                  </div>
                )}
              </div>

              <div className="shrink-0 text-left sm:text-right">
                <p className="text-xs text-muted-foreground">
                  Total
                </p>

                <p className="text-2xl font-bold text-primary">
                  ₹
                  {bill.grandTotal.toFixed(
                    2,
                  )}
                </p>

                {bill.dueAmount >
                  0 && (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    Due: ₹
                    {bill.dueAmount.toFixed(
                      2,
                    )}
                  </p>
                )}
              </div>
            </Link>
          ))}

          {bills.length ===
            0 && (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
              No bills found.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}