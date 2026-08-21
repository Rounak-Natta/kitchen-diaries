import Link from "next/link";
import {
  Plus,
  Settings,
} from "lucide-react";
import {
  redirect,
} from "next/navigation";

import {
  UserTable,
} from "@/features/users/components/user-table";
import {
  getRestaurantUsers,
} from "@/features/users/queries/user-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

export default async function UsersPage() {
  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.USERS_READ,
    )
  ) {
    redirect(
      "/unauthorized",
    );
  }

  if (!user.restaurantId) {
    redirect(
      "/unauthorized",
    );
  }

  const users =
    await getRestaurantUsers(
      user.restaurantId,
    );

  const canCreate =
    hasPermission(
      user.role,
      PERMISSIONS.USERS_CREATE,
    );

  const canUpdate =
    hasPermission(
      user.role,
      PERMISSIONS.USERS_UPDATE,
    );

  const canDeactivate =
    hasPermission(
      user.role,
      PERMISSIONS.USERS_DEACTIVATE,
    );

  const canReadSettings =
    hasPermission(
      user.role,
      PERMISSIONS.SETTINGS_READ,
    );

  const activeUsers =
    users.filter(
      (entry) =>
        entry.isActive,
    ).length;

  return (
            <main className="min-h-screen bg-muted/20 p-4 md:p-6">
                <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Users
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Manage restaurant
              users, roles and
              account access.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canReadSettings && (
              <Link
                href="/settings/restaurant"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition hover:bg-muted"
              >
                <Settings className="h-4 w-4" />
                Restaurant Settings
              </Link>
            )}

            {canCreate && (
              <Link
                href="/users/new"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                New User
              </Link>
            )}
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Total Users
            </p>

            <p className="mt-2 text-2xl font-bold">
              {users.length}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Active Users
            </p>

            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {activeUsers}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Inactive Users
            </p>

            <p className="mt-2 text-2xl font-bold text-red-700">
              {users.length -
                activeUsers}
            </p>
          </div>
        </section>

        <UserTable
          users={users}
          actorRole={
            user.role
          }
          currentUserId={
            user.id
          }
          canUpdate={
            canUpdate
          }
          canDeactivate={
            canDeactivate
          }
        />
      </div>
    </main>
  );
}