import type {
  BillDetailsDto,
} from "../types";

interface BillReceiptProps {
  bill: BillDetailsDto;
}

function formatDateTime(
  value: string,
): string {
  return new Date(
    value,
  ).toLocaleString(
    "en-IN",
    {
      timeZone:
        "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

export function BillReceipt({
  bill,
}: BillReceiptProps) {
  return (
    <div className="w-full overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="border-b p-5 text-center">
        <h2 className="text-xl font-bold">
          {bill.restaurant.name}
        </h2>

        {bill.restaurant.address && (
          <p className="mt-1 text-xs text-muted-foreground">
            {
              bill.restaurant
                .address
            }
          </p>
        )}

        {bill.restaurant.phone && (
          <p className="text-xs text-muted-foreground">
            {
              bill.restaurant
                .phone
            }
          </p>
        )}

        {bill.restaurant.email && (
          <p className="text-xs text-muted-foreground">
            {
              bill.restaurant
                .email
            }
          </p>
        )}
      </header>

      <section className="space-y-1 border-b p-4 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">
            Bill number
          </span>

          <span className="font-mono font-semibold">
            {bill.billNumber}
          </span>
        </div>

        {bill.receiptNumber && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">
              Receipt number
            </span>

            <span className="font-mono font-semibold">
              {
                bill.receiptNumber
              }
            </span>
          </div>
        )}

        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">
            Order number
          </span>

          <span className="font-mono font-semibold">
            {bill.orderNumber}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">
            Date
          </span>

          <span>
            {formatDateTime(
              bill.createdAt,
            )}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">
            Cashier
          </span>

          <span>
            {bill.createdByName}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">
            Order type
          </span>

          <span>
            {bill.orderType}
          </span>
        </div>

        {bill.tableNumber && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">
              Table
            </span>

            <span>
              {bill.tableNumber}
            </span>
          </div>
        )}

        {bill.customerName && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">
              Customer
            </span>

            <span>
              {bill.customerName}
            </span>
          </div>
        )}

        {bill.customerPhone && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">
              Phone
            </span>

            <span>
              {bill.customerPhone}
            </span>
          </div>
        )}
      </section>

      <section className="p-4">
        <div className="grid grid-cols-12 border-b pb-2 text-xs font-semibold">
          <div className="col-span-7">
            Item
          </div>

          <div className="col-span-2 text-center">
            Qty
          </div>

          <div className="col-span-3 text-right">
            Amount
          </div>
        </div>

        <div className="divide-y">
          {bill.items.map(
            (item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 py-3 text-xs"
              >
                <div className="col-span-7 pr-2">
                  <p className="font-medium">
                    {
                      item.itemName
                    }
                  </p>

                  {item.variationName && (
                    <p className="text-[11px] text-muted-foreground">
                      {
                        item.variationName
                      }
                    </p>
                  )}

                  {item.addonNames
                    .length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      +{" "}
                      {item.addonNames.join(
                        ", ",
                      )}
                    </p>
                  )}

                  {item.notes && (
                    <p className="text-[11px] italic text-muted-foreground">
                      Note:{" "}
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="col-span-2 text-center">
                  {item.quantity}
                </div>

                <div className="col-span-3 text-right font-medium">
                  ₹
                  {item.totalPrice.toFixed(
                    2,
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="space-y-2 border-t p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Subtotal
          </span>

          <span>
            ₹
            {bill.subtotal.toFixed(
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
            {bill.tax.toFixed(
              2,
            )}
          </span>
        </div>

        {bill.discount >
          0 && (
          <div className="flex justify-between text-destructive">
            <span>
              Discount
            </span>

            <span>
              -₹
              {bill.discount.toFixed(
                2,
              )}
            </span>
          </div>
        )}

        {bill.serviceCharge >
          0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Service charge
            </span>

            <span>
              ₹
              {bill.serviceCharge.toFixed(
                2,
              )}
            </span>
          </div>
        )}

        {bill.deliveryCharge >
          0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Delivery
            </span>

            <span>
              ₹
              {bill.deliveryCharge.toFixed(
                2,
              )}
            </span>
          </div>
        )}

        {bill.packagingCharge >
          0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Packaging
            </span>

            <span>
              ₹
              {bill.packagingCharge.toFixed(
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
            {bill.grandTotal.toFixed(
              2,
            )}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Paid
          </span>

          <span className="font-medium text-emerald-600">
            ₹
            {bill.amountPaid.toFixed(
              2,
            )}
          </span>
        </div>

        {bill.changeReturned >
          0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Change returned
            </span>

            <span>
              ₹
              {bill.changeReturned.toFixed(
                2,
              )}
            </span>
          </div>
        )}

        {bill.dueAmount >
          0 && (
          <div className="flex justify-between font-semibold text-destructive">
            <span>Due</span>

            <span>
              ₹
              {bill.dueAmount.toFixed(
                2,
              )}
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Payment status
          </span>

          <span className="font-semibold">
            {bill.paymentStatus}
          </span>
        </div>
      </section>

      {bill.payments.length >
        0 && (
        <section className="border-t p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Payment History
          </h3>

          <div className="space-y-2 text-xs">
            {bill.payments.map(
              (payment) => (
                <div
                  key={payment.id}
                  className="rounded-md bg-muted/40 p-3"
                >
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {
                        payment.method
                      }
                    </span>

                    <span className="font-semibold">
                      ₹
                      {payment.amount.toFixed(
                        2,
                      )}
                    </span>
                  </div>

                  <p className="mt-1 text-muted-foreground">
                    {formatDateTime(
                      payment.createdAt,
                    )}
                    {payment.recordedByName
                      ? ` · ${payment.recordedByName}`
                      : ""}
                  </p>

                  {payment.referenceNo && (
                    <p className="mt-1 text-muted-foreground">
                      Reference:{" "}
                      {
                        payment.referenceNo
                      }
                    </p>
                  )}
                </div>
              ),
            )}
          </div>
        </section>
      )}

      <footer className="border-t p-4 text-center text-xs text-muted-foreground">
        Thank you · Visit
        Again
      </footer>
    </div>
  );
}