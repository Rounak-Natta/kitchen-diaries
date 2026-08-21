import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import {
  RecipeRuleList,
} from "@/features/recipe-rules/components/recipe-rule-list";
import {
  getVariationRecipeRuleList,
} from "@/features/recipe-rules/queries/recipe-rule-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

export default async function VariationRecipeRulesPage() {
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

  const variations =
    await getVariationRecipeRuleList(
      user.restaurantId,
    );

  const canEdit =
    hasPermission(
      user.role,
      PERMISSIONS.RECIPE_UPDATE,
    );

  const configuredCount =
    variations.filter(
      (variation) =>
        variation.ruleCount > 0,
    ).length;

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link
            href="/recipes"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Recipes
          </Link>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Variation Recipe Rules
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Configure how variation
            options add, replace or
            remove recipe ingredients.
          </p>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Variation Options
            </p>

            <p className="mt-2 text-3xl font-bold">
              {variations.length}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Configured
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {configuredCount}
            </p>
          </div>
        </div>

        <RecipeRuleList
          items={variations.map(
            (variation) => ({
              id:
                variation.id,

              name:
                variation.name,

              description:
                variation.groupName,

              ruleCount:
                variation.ruleCount,

              href:
                `/recipes/variations/${variation.id}`,
            }),
          )}
          canEdit={canEdit}
          emptyMessage="No active variation options found."
        />
      </div>
    </main>
  );
}