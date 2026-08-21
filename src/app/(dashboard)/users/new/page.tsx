import Link from "next/link";
import {
  ArrowLeft,
} from "lucide-react";
import {
  redirect,
} from "next/navigation";

import {
  UserForm,
} from "@/features/users/components/user-form";
import {
  getAssignableRoles,
} from "@/features/users/lib/user-access";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

export default async function NewUserPage() {
  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.USERS_CREATE,
    )
  ) {
    redirect(
      "/unauthorized",
    );
  }

  const allowedRoles =
    getAssignableRoles(
      user.role,
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
            Create User
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Create a new account
            for this restaurant.
          </p>
        </header>

        <UserForm
          mode="create"
          allowedRoles={
            allowedRoles
          }
        />
      </div>
    </main>
  );
}