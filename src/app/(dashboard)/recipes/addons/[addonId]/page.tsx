import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  RecipeRuleEditor,
} from "@/features/recipe-rules/components/recipe-rule-editor";
import {
  getAddonRecipeRuleEditorData,
} from "@/features/recipe-rules/queries/recipe-rule-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface AddonRecipeRuleEditorPageProps {
  params: Promise<{
    addonId: string;
  }>;
}

export default async function AddonRecipeRuleEditorPage({
  params,
}: AddonRecipeRuleEditorPageProps) {
  const { addonId } =
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
    await getAddonRecipeRuleEditorData(
      user.restaurantId,
      addonId,
    );

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            href="/recipes/addons"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Add-on Rules
          </Link>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Configure Add-on
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Define inventory
            quantities consumed when
            this add-on is sold.
          </p>
        </div>

        <RecipeRuleEditor
          mode="ADDON"
          entityId={
            data.addon.id
          }
          entityName={
            data.addon.name
          }
          entityDescription={`Selling price: ₹${data.addon.price.toFixed(
            2,
          )}`}
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