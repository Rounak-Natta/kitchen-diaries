import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  InventoryItemForm,
} from "@/features/inventory/components/inventory-item-form";
import {
  getInventoryItemFormData,
} from "@/features/inventory/queries/inventory-form-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface EditInventoryItemPageProps {
  params: Promise<{
    itemId: string;
  }>;
}

export default async function EditInventoryItemPage({
  params,
}: EditInventoryItemPageProps) {
  const { itemId } =
    await params;

  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.INVENTORY_UPDATE,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  const data =
    await getInventoryItemFormData(
      user.restaurantId,
      itemId,
    );

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            href="/inventory"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Inventory
          </Link>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Edit Inventory Item
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Update inventory master information. Stock quantity is changed separately.
          </p>
        </div>

        <InventoryItemForm
          data={data}
        />
      </div>
    </main>
  );
}