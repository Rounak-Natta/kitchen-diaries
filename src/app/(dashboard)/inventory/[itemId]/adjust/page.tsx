import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  InventoryAdjustmentForm,
} from "@/features/inventory/components/inventory-adjustment-form";
import {
  getInventoryItem,
} from "@/features/inventory/queries/inventory-queries";
import type {
  ManualInventoryTransactionType,
} from "@/features/inventory/types";
import { getAuthUser } from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface InventoryAdjustmentPageProps {
  params: Promise<{
    itemId: string;
  }>;
}

export default async function InventoryAdjustmentPage({
  params,
}: InventoryAdjustmentPageProps) {
  const { itemId } =
    await params;

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

  if (
    !canStockIn &&
    !canAdjust
  ) {
    redirect("/unauthorized");
  }

  const item =
    await getInventoryItem(
      user.restaurantId,
      itemId,
    );

  if (!item) {
    notFound();
  }

  const allowedTypes:
    ManualInventoryTransactionType[] =
      [];

  if (canStockIn) {
    allowedTypes.push(
      "STOCK_IN",
    );
  }

  if (canAdjust) {
    allowedTypes.push(
      "STOCK_OUT",
      "ADJUSTMENT_IN",
      "ADJUSTMENT_OUT",
    );
  }

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link
            href="/inventory"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Inventory
          </Link>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Update Stock
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Record a manual
            inventory transaction.
          </p>
        </div>

        <InventoryAdjustmentForm
          item={item}
          allowedTypes={
            allowedTypes
          }
        />
      </div>
    </main>
  );
}