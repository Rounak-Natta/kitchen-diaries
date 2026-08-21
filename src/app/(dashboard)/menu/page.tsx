// app/(dashboard)/menu/page.tsx
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/api-auth";
import { hasPermission, PERMISSIONS, Roles } from "@/lib/rbac";
import { MenuList } from "@/features/menu/components/menu-list";

export default async function MenuPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role as Roles, PERMISSIONS.MENU_VIEW)) redirect("/unauthorized");

  return (
    <main className="space-y-6">
      <MenuList />
    </main>
  );
}