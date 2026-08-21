// app/(dashboard)/addons/page.tsx

import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/api-auth";

import {
  hasPermission,
  PERMISSIONS,
  Roles,
} from "@/lib/rbac";

import { AddonList } from "@/features/addons/components/addon-list";

export default async function AddonsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const allowed = hasPermission(
    user.role as Roles,
    PERMISSIONS.MENU_VIEW
  );

  if (!allowed) {
    redirect("/unauthorized");
  }

  return (
    <main className="space-y-6">
      <AddonList />
    </main>
  );
}