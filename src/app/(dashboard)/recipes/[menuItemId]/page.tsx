import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  RecipeEditorForm,
} from "@/features/recipes/components/recipe-editor-form";
import {
  getRecipeEditorData,
} from "@/features/recipes/queries/recipe-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface RecipeEditorPageProps {
  params: Promise<{
    menuItemId: string;
  }>;
}

export default async function RecipeEditorPage({
  params,
}: RecipeEditorPageProps) {
  const { menuItemId } =
    await params;

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

  const data =
    await getRecipeEditorData(
      user.restaurantId,
      menuItemId,
    );

  if (!data) {
    notFound();
  }

  const requiredPermission =
    data.recipe
      ? PERMISSIONS.RECIPE_UPDATE
      : PERMISSIONS.RECIPE_CREATE;

  if (
    !hasPermission(
      user.role,
      requiredPermission,
    )
  ) {
    redirect("/unauthorized");
  }

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            href="/recipes"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Recipes
          </Link>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            {data.recipe
              ? "Edit Recipe"
              : "Create Recipe"}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Define ingredient
            quantities for one
            serving of{" "}
            {data.menuItem.name}.
          </p>
        </div>

        <RecipeEditorForm
          data={data}
        />
      </div>
    </main>
  );
}