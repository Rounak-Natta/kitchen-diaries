import {
  redirect,
} from "next/navigation";

import {
  BillingForm,
} from "@/features/billing/components/billing-form";
import { LocalBillingCreate } from "@/features/billing/components/local-billing-create";
import {
  getExistingBillIdForOrder,
  getOrderForBilling,
  resolveBillingOrderId,
} from "@/features/billing/queries/billing-queries";
import { getAuthUser } from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface CreateBillPageProps {
  params: Promise<{
    orderId: string;
  }>;
}

export default async function CreateBillPage({
  params,
}: CreateBillPageProps) {
  const { orderId } =
    await params;

  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.BILLING_CREATE,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  // The URL may contain an IndexedDB/local order UUID. If that order has
  // already synced, resolve it through the completed CREATE sync operation so
  // billing does not depend on the browser having received serverOrderId yet.
  const resolvedOrderId =
    await resolveBillingOrderId(
      user.restaurantId,
      orderId,
    );

  const existingBillId =
    await getExistingBillIdForOrder(
      user.restaurantId,
      resolvedOrderId,
    );

  if (existingBillId) {
    redirect(
      `/billing/${existingBillId}`,
    );
  }

  const order =
    await getOrderForBilling(
      user.restaurantId,
      resolvedOrderId,
    );

  if (!order) {
    return <LocalBillingCreate orderId={orderId} />;
  }

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            Billing for{" "}
            {order.orderNumber}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {order.orderType}
            {order.tableNumber
              ? ` · Table ${order.tableNumber}`
              : ""}
            {" · "}
            {new Date(
              order.createdAt,
            ).toLocaleString(
              "en-IN",
              {
                timeZone:
                  "Asia/Kolkata",
              },
            )}
          </p>
        </div>

        <div className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">
            Order Items
          </h2>

          <div className="divide-y">
            {order.items.map(
              (item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">
                      {
                        item.itemName
                      }
                    </p>

                    <p className="text-sm text-muted-foreground">
                      Quantity:{" "}
                      {
                        item.quantity
                      }
                    </p>

                    {item.variationName && (
                      <p className="text-xs text-primary">
                        +{" "}
                        {
                          item.variationName
                        }
                      </p>
                    )}

                    {item.addons.length >
                      0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        +{" "}
                        {item.addons
                          .map(
                            (
                              addon,
                            ) =>
                              addon.name,
                          )
                          .join(", ")}
                      </p>
                    )}

                    {item.notes && (
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        Note:{" "}
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <p className="font-semibold">
                    ₹
                    {item.totalPrice.toFixed(
                      2,
                    )}
                  </p>
                </div>
              ),
            )}
          </div>

          <div className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Subtotal
              </span>

              <span>
                ₹
                {order.subtotal.toFixed(
                  2,
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Tax
              </span>

              <span>
                ₹
                {order.tax.toFixed(
                  2,
                )}
              </span>
            </div>

            {order.discount >
              0 && (
              <div className="flex justify-between text-destructive">
                <span>
                  Discount
                </span>

                <span>
                  -₹
                  {order.discount.toFixed(
                    2,
                  )}
                </span>
              </div>
            )}

            <div className="flex justify-between border-t pt-3 text-lg font-bold">
              <span>
                Grand Total
              </span>

              <span className="text-primary">
                ₹
                {order.total.toFixed(
                  2,
                )}
              </span>
            </div>
          </div>
        </div>

        <BillingForm
          order={order}
        />
      </div>
    </main>
  );
}