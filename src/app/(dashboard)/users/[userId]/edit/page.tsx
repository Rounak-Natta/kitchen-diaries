import Link from "next/link";
import {
  ArrowLeft,
} from "lucide-react";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  UserForm,
} from "@/features/users/components/user-form";
import {
  canManageTargetRole,
  getAssignableRoles,
} from "@/features/users/lib/user-access";
import {
  getRestaurantUserForEdit,
} from "@/features/users/queries/user-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface EditUserPageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default async function EditUserPage({
  params,
}: EditUserPageProps) {
  const { userId } =
    await params;

  const actor =
    await getAuthUser();

  if (!actor) {
    redirect("/login");
  }

  if (
    !hasPermission(
      actor.role,
      PERMISSIONS.USERS_UPDATE,
    )
  ) {
    redirect(
      "/unauthorized",
    );
  }

  if (!actor.restaurantId) {
    redirect(
      "/unauthorized",
    );
  }

  const targetUser =
    await getRestaurantUserForEdit(
      actor.restaurantId,
      userId,
    );

  if (!targetUser) {
    notFound();
  }

  if (
    !canManageTargetRole(
      actor.role,
      targetUser.role,
    )
  ) {
    redirect(
      "/unauthorized",
    );
  }

  const allowedRoles =
    getAssignableRoles(
      actor.role,
    );

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <Link
            href="/users"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            Edit User
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Update{" "}
            {targetUser.name}
            &apos;s account
            details.
          </p>
        </header>

        <UserForm
          mode="edit"
          user={targetUser}
          allowedRoles={
            allowedRoles
          }
          roleLocked={
            targetUser.id ===
            actor.id
          }
        />
      </div>
    </main>
  );
}