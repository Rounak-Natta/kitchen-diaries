import {
  redirect,
} from "next/navigation";

import {
  AnalyticsDashboard,
} from "@/features/analytics/components/analytics-dashboard";
import {
  getAnalyticsDashboard,
} from "@/features/analytics/queries/analytics-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface AnalyticsPageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
}

export default async function AnalyticsPage({
  searchParams,
}: AnalyticsPageProps) {
  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.ANALYTICS_READ,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  const filters =
    await searchParams;

  const canViewProfit =
    hasPermission(
      user.role,
      PERMISSIONS.PROFIT_ANALYTICS_READ,
    );

  const data =
    await getAnalyticsDashboard(
      user.restaurantId,
      {
        from:
          filters.from,

        to:
          filters.to,
      },
      canViewProfit,
    );

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            Analytics
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Review sales,
            collections, inventory
            costs, profit and wastage.
          </p>
        </div>

        <AnalyticsDashboard
          data={data}
        />
      </div>
    </main>
  );
}