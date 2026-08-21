import {
  Plus,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import {
  redirect,
} from "next/navigation";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import {
  OrdersList,
} from "@/features/orders/components/orders-list";
import {
  getOrdersForList,
} from "@/features/orders/queries/get-orders";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

export default async function OrdersPage() {
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

  const canCreateOrder =
    hasPermission(
      user.role,
      PERMISSIONS.ORDERS_CREATE,
    );

  const queryClient =
    new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: [
      "orders",
    ],

    queryFn: () =>
      getOrdersForList(
        user.restaurantId,
      ),
  });

  return (
    <HydrationBoundary
      state={dehydrate(
        queryClient,
      )}
    >
      <main className="min-h-screen bg-muted/20 p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Orders
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Manage restaurant
                orders, lifecycle
                status and billing.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/orders/reconciliation"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-card px-4 text-sm font-medium shadow-sm transition hover:bg-muted"
              >
                <ShieldCheck className="h-4 w-4" />

                Reconciliation
              </Link>

              {canCreateOrder && (
                <Link
                  href="/orders/new"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />

                  New Order
                </Link>
              )}
            </div>
          </header>

          <OrdersList />
        </div>
      </main>
    </HydrationBoundary>
  );
}