import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  BillAdjustmentPanel,
} from "@/features/billing-adjustments/components/bill-adjustment-panel";
import {
  getBillAdjustmentData,
} from "@/features/billing-adjustments/queries/billing-adjustment-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface BillAdjustmentsPageProps {
  params: Promise<{
    billId: string;
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

export default async function BillAdjustmentsPage({
  params,
}: BillAdjustmentsPageProps) {
  const { billId } =
    await params;

  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.BILLING_READ,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  const bill =
    await getBillAdjustmentData(
      user.restaurantId,
      billId,
    );

  if (!bill) {
    notFound();
  }

  const canCancel =
    hasPermission(
      user.role,
      PERMISSIONS.BILLING_CANCEL,
    );

  const canRefund =
    hasPermission(
      user.role,
      PERMISSIONS.BILLING_REFUND,
    );

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link
            href={`/billing/${bill.id}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Bill
          </Link>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Bill Adjustments
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {bill.billNumber}
            {" · "}
            Order{" "}
            {bill.orderNumber}
          </p>
        </div>

        <section className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">
                Bill Status
              </p>

              <p className="mt-1 font-semibold">
                {formatLabel(
                  bill.status,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Paid
              </p>

              <p className="mt-1 font-semibold">
                ₹
                {bill.amountPaid.toFixed(
                  2,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Refunded
              </p>

              <p className="mt-1 font-semibold">
                ₹
                {bill.refundedAmount.toFixed(
                  2,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Refundable
              </p>

              <p className="mt-1 font-semibold">
                ₹
                {bill.refundableAmount.toFixed(
                  2,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Payment Status
              </p>

              <p className="mt-1 font-semibold">
                {formatLabel(
                  bill.paymentStatus,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Inventory
              </p>

              <p className="mt-1 font-semibold">
                {formatLabel(
                  bill.inventoryStatus,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Grand Total
              </p>

              <p className="mt-1 font-semibold">
                ₹
                {bill.grandTotal.toFixed(
                  2,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Due
              </p>

              <p className="mt-1 font-semibold">
                ₹
                {bill.dueAmount.toFixed(
                  2,
                )}
              </p>
            </div>
          </div>
        </section>

        <BillAdjustmentPanel
          bill={bill}
          canCancel={canCancel}
          canRefund={canRefund}
        />

        {bill.refunds.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b p-5">
              <h2 className="font-semibold">
                Refund History
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      Refund
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Method
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Reason
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Recorded By
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {bill.refunds.map(
                    (refund) => (
                      <tr
                        key={refund.id}
                      >
                        <td className="px-4 py-4">
                          <p className="font-mono text-xs font-semibold">
                            {
                              refund.refundNumber
                            }
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(
                              refund.createdAt,
                            ).toLocaleString(
                              "en-IN",
                              {
                                timeZone:
                                  "Asia/Kolkata",
                              },
                            )}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          {formatLabel(
                            refund.method,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {refund.reason}
                        </td>

                        <td className="px-4 py-4">
                          {
                            refund.createdByName
                          }
                        </td>

                        <td className="px-4 py-4 text-right font-semibold">
                          ₹
                          {refund.amount.toFixed(
                            2,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}