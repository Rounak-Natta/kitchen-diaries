import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  ReceiptText,
} from "lucide-react";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  BillAdjustmentLink,
} from "@/features/billing-adjustments/components/bill-adjustment-link";
import {
  AdditionalPaymentForm,
} from "@/features/billing/components/additional-payment-form";
import {
  BillReceipt,
} from "@/features/billing/components/bill-receipt";
import {
  getBillDetails,
} from "@/features/billing/queries/billing-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface BillPageProps {
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

function getBillStatusClass(
  status: string,
): string {
  switch (status) {
    case "CANCELLED":
      return "bg-red-50 text-red-700";

    case "PARTIALLY_REFUNDED":
      return "bg-amber-50 text-amber-700";

    case "REFUNDED":
      return "bg-slate-100 text-slate-700";

    default:
      return "bg-emerald-50 text-emerald-700";
  }
}

function getPaymentStatusClass(
  paymentStatus: string,
): string {
  switch (paymentStatus) {
    case "PAID":
      return "bg-emerald-50 text-emerald-700";

    case "PARTIAL":
      return "bg-amber-50 text-amber-700";

    case "PARTIALLY_REFUNDED":
      return "bg-orange-50 text-orange-700";

    case "REFUNDED":
      return "bg-slate-100 text-slate-700";

    default:
      return "bg-red-50 text-red-700";
  }
}

export default async function BillPage({
  params,
}: BillPageProps) {
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
    await getBillDetails(
      user.restaurantId,
      billId,
    );

  if (!bill) {
    notFound();
  }

  const canRecordPayment =
    hasPermission(
      user.role,
      PERMISSIONS.BILLING_PAYMENT_ADD,
    );

  const canCancelBill =
    hasPermission(
      user.role,
      PERMISSIONS.BILLING_CANCEL,
    );

  const canRefundBill =
    hasPermission(
      user.role,
      PERMISSIONS.BILLING_REFUND,
    );

  const isActiveBill =
    bill.status === "ACTIVE";

  const hasOutstandingAmount =
    bill.dueAmount > 0;

  const shouldShowPaymentForm =
    isActiveBill &&
    hasOutstandingAmount &&
    canRecordPayment;

  let paymentMessage =
    "This bill is fully paid.";

  if (
    bill.status === "CANCELLED"
  ) {
    paymentMessage =
      "This bill has been cancelled. Additional payments are not allowed.";
  } else if (
    bill.status === "REFUNDED"
  ) {
    paymentMessage =
      "This bill has been fully refunded.";
  } else if (
    bill.status ===
    "PARTIALLY_REFUNDED"
  ) {
    paymentMessage =
      "This bill has been partially refunded. Further refunds can be recorded from Bill Adjustments.";
  } else if (
    hasOutstandingAmount &&
    !canRecordPayment
  ) {
    paymentMessage =
      "You do not have permission to record additional payments.";
  }

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <Link
            href="/billing"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Billing
          </Link>

          <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">
                  {bill.billNumber}
                </h1>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBillStatusClass(
                    bill.status,
                  )}`}
                >
                  {formatLabel(
                    bill.status,
                  )}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <ReceiptText className="h-4 w-4" />

                  Receipt:{" "}
                  {bill.receiptNumber ??
                    "Not generated"}
                </span>

                <span>
                  Order:{" "}
                  {bill.orderNumber}
                </span>

                <span>
                  Business date:{" "}
                  {bill.businessDate ??
                    "—"}
                </span>
              </div>
            </div>

            <BillAdjustmentLink
              billId={bill.id}
              status={bill.status}
              canCancel={
                canCancelBill
              }
              canRefund={
                canRefundBill
              }
            />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <BillReceipt bill={bill} />

          <aside className="space-y-4">
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <CreditCard className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Payment Status
                  </p>

                  <span
                    className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getPaymentStatusClass(
                      bill.paymentStatus,
                    )}`}
                  >
                    {formatLabel(
                      bill.paymentStatus,
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-3 border-t pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Grand Total
                  </span>

                  <span className="font-semibold">
                    ₹
                    {bill.grandTotal.toFixed(
                      2,
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Amount Paid
                  </span>

                  <span className="font-semibold text-emerald-700">
                    ₹
                    {bill.amountPaid.toFixed(
                      2,
                    )}
                  </span>
                </div>

                {bill.refundedAmount >
                  0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Refunded
                    </span>

                    <span className="font-semibold text-amber-700">
                      ₹
                      {bill.refundedAmount.toFixed(
                        2,
                      )}
                    </span>
                  </div>
                )}

                {bill.changeReturned >
                  0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Change Returned
                    </span>

                    <span className="font-semibold">
                      ₹
                      {bill.changeReturned.toFixed(
                        2,
                      )}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t pt-3">
                  <span className="font-medium">
                    Outstanding
                  </span>

                  <span
                    className={
                      hasOutstandingAmount
                        ? "font-bold text-destructive"
                        : "font-bold text-emerald-700"
                    }
                  >
                    ₹
                    {bill.dueAmount.toFixed(
                      2,
                    )}
                  </span>
                </div>
              </div>
            </section>

            {shouldShowPaymentForm ? (
              <AdditionalPaymentForm
                key={`${bill.id}-${bill.dueAmount}`}
                billId={bill.id}
                dueAmount={
                  bill.dueAmount
                }
              />
            ) : (
              <section className="rounded-xl border bg-card p-5 text-sm shadow-sm">
                <p className="font-semibold">
                  Payment Information
                </p>

                <p className="mt-2 leading-6 text-muted-foreground">
                  {paymentMessage}
                </p>

                {isActiveBill &&
                  hasOutstandingAmount && (
                    <div className="mt-4 flex items-center justify-between border-t pt-4">
                      <span className="text-muted-foreground">
                        Outstanding
                      </span>

                      <span className="font-semibold text-destructive">
                        ₹
                        {bill.dueAmount.toFixed(
                          2,
                        )}
                      </span>
                    </div>
                  )}
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}