// app/(dashboard)/categories/page.tsx
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/api-auth";
import { hasPermission, PERMISSIONS, Roles } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { CategoryList } from "@/features/categories/components/category-list";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";

export default async function CategoriesPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role as Roles, PERMISSIONS.CATEGORY_MANAGE)) redirect("/unauthorized");

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const categories = await prisma.category.findMany({
        where: { restaurantId: user.restaurantId },
        select: { id: true, name: true, slug: true, description: true, type: true, dietaryType: true, isActive: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      return categories;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="space-y-6">
        <CategoryList />
      </main>
    </HydrationBoundary>
  );
}