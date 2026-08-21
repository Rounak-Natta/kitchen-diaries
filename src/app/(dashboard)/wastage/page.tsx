import Link from "next/link";
import {
  Plus,
} from "lucide-react";
import {
  redirect,
} from "next/navigation";

import {
  WastageList,
} from "@/features/wastage/components/wastage-list";
import {
  getWastageList,
} from "@/features/wastage/queries/wastage-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

export default async function WastagePage() {
  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.WASTAGE_READ,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  const wastages =
    await getWastageList(
      user.restaurantId,
    );

  const canCreate =
    hasPermission(
      user.role,
      PERMISSIONS.WASTAGE_CREATE,
    );

  const draftCount =
    wastages.filter(
      (wastage) =>
        wastage.status ===
        "DRAFT",
    ).length;

  const postedCost =
    wastages
      .filter(
        (wastage) =>
          wastage.status ===
          "POSTED",
      )
      .reduce(
        (sum, wastage) =>
          sum +
          wastage.totalCost,
        0,
      );

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Wastage
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Record, approve and
              track inventory wastage.
            </p>
          </div>

          {canCreate && (
            <Link
              href="/wastage/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create Wastage
            </Link>
          )}
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Total Records
            </p>

            <p className="mt-2 text-3xl font-bold">
              {wastages.length}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Drafts
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-600">
              {draftCount}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Posted Wastage Cost
            </p>

            <p className="mt-2 text-3xl font-bold text-red-600">
              ₹
              {postedCost.toFixed(
                2,
              )}
            </p>
          </div>
        </div>

        <WastageList
          wastages={
            wastages
          }
        />
      </div>
    </main>
  );
}