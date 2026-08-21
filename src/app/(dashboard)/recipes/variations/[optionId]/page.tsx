import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  RecipeRuleEditor,
} from "@/features/recipe-rules/components/recipe-rule-editor";
import {
  getVariationRecipeRuleEditorData,
} from "@/features/recipe-rules/queries/recipe-rule-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface VariationRecipeRuleEditorPageProps {
  params: Promise<{
    optionId: string;
  }>;
}

export default async function VariationRecipeRuleEditorPage({
  params,
}: VariationRecipeRuleEditorPageProps) {
  const { optionId } =
    await params;

  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.RECIPE_UPDATE,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  const data =
    await getVariationRecipeRuleEditorData(
      user.restaurantId,
      optionId,
    );

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            href="/recipes/variations"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Variation Rules
          </Link>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Configure Variation
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Define recipe changes
            applied when this variation
            is selected.
          </p>
        </div>

        <RecipeRuleEditor
          mode="VARIATION"
          entityId={
            data.variationOption.id
          }
          entityName={
            data.variationOption.name
          }
          entityDescription={
            data.variationOption
              .groupName
          }
          initialRules={
            data.rules
          }
          inventoryItems={
            data.inventoryItems
          }
        />
      </div>
    </main>
  );
}