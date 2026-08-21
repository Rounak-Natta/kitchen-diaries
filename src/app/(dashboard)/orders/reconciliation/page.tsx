import Link from "next/link";
import {
  ArrowLeft,
} from "lucide-react";
import {
  redirect,
} from "next/navigation";

import {
  OrderReconciliationTable,
} from "@/features/order-lifecycle/components/order-reconciliation-table";
import {
  getOrderReconciliationIssues,
} from "@/features/order-lifecycle/queries/order-lifecycle-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

export default async function OrderReconciliationPage() {
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

  const issues =
    await getOrderReconciliationIssues(
      user.restaurantId,
    );

  const canRepair =
    hasPermission(
      user.role,
      PERMISSIONS.ORDERS_UPDATE,
    );

  const highSeverityCount =
    issues.filter(
      (issue) =>
        issue.severity ===
        "HIGH",
    ).length;

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            Order Reconciliation
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Detect order, billing and
            inventory lifecycle
            inconsistencies.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Total Issues
            </p>

            <p className="mt-2 text-2xl font-bold">
              {issues.length}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              High Severity
            </p>

            <p className="mt-2 text-2xl font-bold text-red-700">
              {highSeverityCount}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Repairable
            </p>

            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {
                issues.filter(
                  (issue) =>
                    issue.repairable,
                ).length
              }
            </p>
          </div>
        </section>

        <OrderReconciliationTable
          issues={issues}
          canRepair={canRepair}
        />
      </div>
    </main>
  );
}