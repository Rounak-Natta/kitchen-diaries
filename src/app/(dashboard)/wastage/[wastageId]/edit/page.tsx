import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  WastageForm,
} from "@/features/wastage/components/wastage-form";
import {
  getWastageFormData,
} from "@/features/wastage/queries/wastage-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface EditWastagePageProps {
  params: Promise<{
    wastageId: string;
  }>;
}

export default async function EditWastagePage({
  params,
}: EditWastagePageProps) {
  const { wastageId } =
    await params;

  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.WASTAGE_CREATE,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  const data =
    await getWastageFormData(
      user.restaurantId,
      wastageId,
    );

  if (!data) {
    notFound();
  }

  if (
    data.wastage?.status !==
    "DRAFT"
  ) {
    redirect(
      `/wastage/${wastageId}`,
    );
  }

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            href={`/wastage/${wastageId}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Wastage
          </Link>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Edit Wastage Draft
          </h1>
        </div>

        <WastageForm
          data={data}
        />
      </div>
    </main>
  );
}