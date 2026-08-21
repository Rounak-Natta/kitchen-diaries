import Link from "next/link";
import {
  redirect,
} from "next/navigation";
import {
  ArrowRightLeft,
  BookOpenText,
  Plus,
} from "lucide-react";

import {
  InventoryTable,
} from "@/features/inventory/components/inventory-table";
import {
  getInventoryItems,
} from "@/features/inventory/queries/inventory-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

export default async function InventoryPage() {
  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.INVENTORY_VIEW,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  const items =
    await getInventoryItems(
      user.restaurantId,
    );

  const canCreateItem =
    hasPermission(
      user.role,
      PERMISSIONS.INVENTORY_CREATE,
    );

  const canEditItem =
    hasPermission(
      user.role,
      PERMISSIONS.INVENTORY_UPDATE,
    );

  const canStockIn =
    hasPermission(
      user.role,
      PERMISSIONS.INVENTORY_STOCK_IN,
    );

  const canAdjust =
    hasPermission(
      user.role,
      PERMISSIONS.INVENTORY_ADJUST,
    );

  const canReadLedger =
    hasPermission(
      user.role,
      PERMISSIONS.INVENTORY_LEDGER_READ,
    );

  const canViewRecipes =
    hasPermission(
      user.role,
      PERMISSIONS.RECIPE_VIEW,
    );

  const lowStockCount =
    items.filter(
      (item) =>
        item.stockStatus ===
        "LOW_STOCK",
    ).length;

  const outOfStockCount =
    items.filter(
      (item) =>
        item.stockStatus ===
        "OUT_OF_STOCK",
    ).length;

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Inventory
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Create inventory masters, update stock, configure recipes and view movements.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canViewRecipes && (
              <Link
                href="/recipes"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-card px-4 text-sm font-medium transition hover:bg-muted"
              >
                <BookOpenText className="h-4 w-4" />
                Manage Recipes
              </Link>
            )}

            {canReadLedger && (
              <Link
                href="/inventory/transactions"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-card px-4 text-sm font-medium transition hover:bg-muted"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Ledger
              </Link>
            )}

            {canCreateItem && (
              <Link
                href="/inventory/new"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add Inventory Item
              </Link>
            )}
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Total Items
            </p>

            <p className="mt-2 text-3xl font-bold">
              {items.length}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Low Stock
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-600">
              {lowStockCount}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Out of Stock
            </p>

            <p className="mt-2 text-3xl font-bold text-red-600">
              {outOfStockCount}
            </p>
          </div>
        </div>

        <InventoryTable
          items={items}
          canEditItem={
            canEditItem
          }
          canUpdateStock={
            canStockIn ||
            canAdjust
          }
        />
      </div>
    </main>
  );
}