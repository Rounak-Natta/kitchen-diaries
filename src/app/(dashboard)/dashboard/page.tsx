import { redirect } from "next/navigation";

import LogoutButton from "@/components/logout-button";

import { getAuthUser } from "@/lib/api-auth";

import {
  hasPermission,
  PERMISSIONS,
  Roles,
} from "@/lib/rbac";

export default async function DashboardPage() {
  const user = await getAuthUser();

  // Not logged in
  if (!user) {
    redirect("/login");
  }

  const userRole = user.role as Roles;

  // Dashboard Access Protection
  if (
    !hasPermission(
      userRole,
      PERMISSIONS.DASHBOARD_ACCESS
    )
  ) {
    redirect("/unauthorized");
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="bg-base rounded-[32px] border border-white/20 p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">
              KD Restaurant POS
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] md:text-4xl">
              Welcome back, {user.name}
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-7 text-black/55">
              Manage restaurant operations, staff, billing,
              menu and customer orders from one dashboard.
            </p>
          </div>

          <LogoutButton />
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="bg-base rounded-3xl border border-white/20 p-5">
          <p className="text-sm text-black/50">
            Role
          </p>

          <h3 className="mt-3 text-2xl font-semibold">
            {user.role}
          </h3>
        </div>

        <div className="bg-base rounded-3xl border border-white/20 p-5">
          <p className="text-sm text-black/50">
            Restaurant
          </p>

          <h3 className="mt-3 text-2xl font-semibold">
            KD POS
          </h3>
        </div>

        <div className="bg-base rounded-3xl border border-white/20 p-5">
          <p className="text-sm text-black/50">
            Status
          </p>

          <h3 className="mt-3 text-2xl font-semibold text-[var(--accent)]">
            Active
          </h3>
        </div>

        <div className="bg-base rounded-3xl border border-white/20 p-5">
          <p className="text-sm text-black/50">
            Restaurant ID
          </p>

          <h3 className="mt-3 truncate text-xl font-semibold">
            {user.restaurantId}
          </h3>
        </div>
      </section>

    </div>
  );
}