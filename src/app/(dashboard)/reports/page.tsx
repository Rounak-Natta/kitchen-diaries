import {
  redirect,
} from "next/navigation";

import {
  ReportsDashboard,
} from "@/features/reports/components/reports-dashboard";
import {
  getReportsDashboard,
} from "@/features/reports/queries/report-queries";
import type {
  ReportRangeInput,
} from "@/features/reports/lib/report-range";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface ReportsPageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
}

export default async function ReportsPage({
  searchParams,
}: ReportsPageProps) {
  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.REPORTS_READ,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  const search =
    await searchParams;

  const rangeInput:
    ReportRangeInput = {};

  if (search.from) {
    rangeInput.from =
      search.from;
  }

  if (search.to) {
    rangeInput.to =
      search.to;
  }

  const canViewProfit =
    hasPermission(
      user.role,
      PERMISSIONS.PROFIT_ANALYTICS_READ,
    );

  const canExport =
    hasPermission(
      user.role,
      PERMISSIONS.REPORTS_EXPORT,
    );

  const data =
    await getReportsDashboard(
      user.restaurantId,
      rangeInput,
      canViewProfit,
    );

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            Reports
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Review and export sales,
            payment, inventory,
            wastage and profit data.
          </p>
        </div>

        <ReportsDashboard
          data={data}
          canExport={canExport}
        />
      </div>
    </main>
  );
}