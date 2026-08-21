// app/(dashboard)/variations/page.tsx
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/api-auth";
import { hasPermission, PERMISSIONS, Roles } from "@/lib/rbac";
import { VariationList } from "@/features/variations/components/variation-list";

export default async function VariationsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role as Roles, PERMISSIONS.MENU_VIEW)) redirect("/unauthorized");

  return (
    <main className="space-y-6">
      <VariationList />
    </main>
  );
}