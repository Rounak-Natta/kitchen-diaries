import Link from "next/link";
import {
  redirect,
} from "next/navigation";
import {
  PackagePlus,
  SlidersHorizontal,
} from "lucide-react";

import {
  RecipeList,
} from "@/features/recipes/components/recipe-list";
import {
  getRecipeList,
} from "@/features/recipes/queries/recipe-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

export default async function RecipesPage() {
  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.RECIPE_VIEW,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  const items =
    await getRecipeList(
      user.restaurantId,
    );

  const canCreate =
    hasPermission(
      user.role,
      PERMISSIONS.RECIPE_CREATE,
    );

  const canUpdate =
    hasPermission(
      user.role,
      PERMISSIONS.RECIPE_UPDATE,
    );

  const configuredCount =
    items.filter(
      (item) =>
        item.recipe !== null,
    ).length;

  const activeCount =
    items.filter(
      (item) =>
        item.recipe?.isActive,
    ).length;

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Recipes
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Configure base menu
              recipes, variation rules
              and add-on ingredients.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/recipes/variations"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-card px-4 text-sm font-medium transition hover:bg-muted"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Variation Rules
            </Link>

            <Link
              href="/recipes/addons"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-card px-4 text-sm font-medium transition hover:bg-muted"
            >
              <PackagePlus className="h-4 w-4" />
              Add-on Rules
            </Link>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Menu Items
            </p>

            <p className="mt-2 text-3xl font-bold">
              {items.length}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Configured Recipes
            </p>

            <p className="mt-2 text-3xl font-bold">
              {configuredCount}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Active Recipes
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {activeCount}
            </p>
          </div>
        </div>

        <RecipeList
          items={items}
          canCreate={canCreate}
          canUpdate={canUpdate}
        />
      </div>
    </main>
  );
}