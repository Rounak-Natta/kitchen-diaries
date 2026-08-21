import Link from "next/link";
import {
  ArrowLeft,
} from "lucide-react";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  RestaurantSettingsForm,
} from "@/features/settings/components/restaurant-settings-form";
import {
  getRestaurantSettings,
} from "@/features/settings/queries/restaurant-settings-query";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

export default async function RestaurantSettingsPage() {
  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.SETTINGS_READ,
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

  const settings =
    await getRestaurantSettings(
      user.restaurantId,
    );

  if (!settings) {
    notFound();
  }

  const canUpdate =
    hasPermission(
      user.role,
      PERMISSIONS.SETTINGS_UPDATE,
    );

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <Link
            href="/users"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            Restaurant Settings
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage restaurant
            contact details and
            default billing values.
          </p>
        </header>

        <RestaurantSettingsForm
          settings={
            settings
          }
          canUpdate={
            canUpdate
          }
        />
      </div>
    </main>
  );
}