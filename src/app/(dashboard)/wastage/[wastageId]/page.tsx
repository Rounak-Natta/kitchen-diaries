import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  WastageActions,
} from "@/features/wastage/components/wastage-actions";
import {
  getWastageDetail,
} from "@/features/wastage/queries/wastage-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface WastageDetailPageProps {
  params: Promise<{
    wastageId: string;
  }>;
}

function formatLabel(
  value: string,
): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export default async function WastageDetailPage({
  params,
}: WastageDetailPageProps) {
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
      PERMISSIONS.WASTAGE_READ,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  const wastage =
    await getWastageDetail(
      user.restaurantId,
      wastageId,
    );

  if (!wastage) {
    notFound();
  }

  const canEdit =
    wastage.status ===
      "DRAFT" &&
    hasPermission(
      user.role,
      PERMISSIONS.WASTAGE_CREATE,
    );

  const canPost =
    hasPermission(
      user.role,
      PERMISSIONS.WASTAGE_POST,
    );

  const canCancel =
    hasPermission(
      user.role,
      PERMISSIONS.WASTAGE_CANCEL,
    );

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/wastage"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to Wastage
            </Link>

            <h1 className="mt-3 text-3xl font-bold tracking-tight">
              {
                wastage.wastageNumber
              }
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Created by{" "}
              {
                wastage.createdByName
              }
            </p>
          </div>

          {canEdit && (
            <Link
              href={`/wastage/${wastage.id}/edit`}
              className="inline-flex h-10 items-center justify-center rounded-md border bg-card px-4 text-sm font-medium transition hover:bg-muted"
            >
              Edit Draft
            </Link>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Status
                  </p>

                  <p className="mt-1 font-semibold">
                    {formatLabel(
                      wastage.status,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Business Date
                  </p>

                  <p className="mt-1 font-semibold">
                    {wastage.businessDate ??
                      "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Total Cost
                  </p>

                  <p className="mt-1 font-semibold">
                    ₹
                    {wastage.totalCost.toFixed(
                      2,
                    )}
                  </p>
                </div>
              </div>

              {wastage.notes && (
                <div className="mt-5 border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    Notes
                  </p>

                  <p className="mt-1 text-sm">
                    {wastage.notes}
                  </p>
                </div>
              )}

              {wastage.cancellationReason && (
                <div className="mt-5 rounded-md bg-red-50 p-3">
                  <p className="text-xs font-medium text-red-700">
                    Cancellation
                    Reason
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    {
                      wastage.cancellationReason
                    }
                  </p>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="border-b p-5">
                <h2 className="font-semibold">
                  Wastage Items
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b bg-muted/40 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">
                        Item
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Reason
                      </th>

                      <th className="px-4 py-3 text-right font-medium">
                        Quantity
                      </th>

                      <th className="px-4 py-3 text-right font-medium">
                        Cost
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Transaction
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {wastage.items.map(
                      (item) => (
                        <tr
                          key={
                            item.id
                          }
                        >
                          <td className="px-4 py-4">
                            <p className="font-medium">
                              {
                                item.inventoryItemName
                              }
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {
                                item.inventoryItemCode
                              }
                            </p>
                          </td>

                          <td className="px-4 py-4">
                            {formatLabel(
                              item.reason,
                            )}
                          </td>

                          <td className="px-4 py-4 text-right">
                            {
                              item.quantity
                            }{" "}
                            {formatLabel(
                              item.unit,
                            )}
                          </td>

                          <td className="px-4 py-4 text-right">
                            ₹
                            {item.totalCost.toFixed(
                              2,
                            )}
                          </td>

                          <td className="px-4 py-4 font-mono text-xs">
                            {item.inventoryTransactionNumber ??
                              "Not posted"}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div>
            <WastageActions
              wastageId={
                wastage.id
              }
              status={
                wastage.status
              }
              canPost={
                canPost
              }
              canCancel={
                canCancel
              }
            />
          </div>
        </div>
      </div>
    </main>
  );
}