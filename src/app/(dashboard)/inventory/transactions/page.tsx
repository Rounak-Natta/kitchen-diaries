import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import {
  InventoryLedgerTable,
} from "@/features/inventory/components/inventory-ledger-table";
import {
  getInventoryLedger,
} from "@/features/inventory/queries/inventory-queries";
import { getAuthUser } from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

export default async function InventoryTransactionsPage() {
  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.INVENTORY_LEDGER_READ,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  const transactions =
    await getInventoryLedger(
      user.restaurantId,
    );

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link
            href="/inventory"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Inventory
          </Link>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Inventory Ledger
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Stock movements,
            balances, references
            and costs.
          </p>
        </div>

        <InventoryLedgerTable
          transactions={
            transactions
          }
        />
      </div>
    </main>
  );
}