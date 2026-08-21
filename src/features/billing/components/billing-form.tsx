"use client";

import {
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { PaymentMethod } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Check,
  CreditCard,
  Loader2,
  Smartphone,
  Wallet,
} from "lucide-react";

import { createBill } from "../actions/billing-actions";
import { createOfflineBill } from "@/lib/local-db/offline-billing";

export interface BillingFormOrder {
  id: string;
  /** Cloud order id when a local-first order has already synchronized. */
  serverOrderId?: string | null;
  /** True when the billing screen was hydrated from the local offline database. */
  localOnly?: boolean;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;

  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
}

interface BillingFormProps {
  order: BillingFormOrder;
}

interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  icon: LucideIcon;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    value: PaymentMethod.CASH,
    label: "Cash",
    icon: Wallet,
  },
  {
    value: PaymentMethod.UPI,
    label: "UPI",
    icon: Smartphone,
  },
  {
    value: PaymentMethod.CARD,
    label: "Card",
    icon: CreditCard,
  },
  {
    value: PaymentMethod.BANK_TRANSFER,
    label: "Bank",
    icon: Building2,
  },
];

export function BillingForm({
  order,
}: BillingFormProps) {
  const router = useRouter();

  const [pending, startTransition] =
    useTransition();

  const [method, setMethod] =
    useState<PaymentMethod>(
      PaymentMethod.CASH,
    );

  const [amount, setAmount] = useState(
    order.total.toFixed(2),
  );

  const [customerName, setCustomerName] =
    useState(order.customerName ?? "");

  const [customerPhone, setCustomerPhone] =
    useState(order.customerPhone ?? "");

  const [
    customerAddress,
    setCustomerAddress,
  ] = useState(
    order.customerAddress ?? "",
  );

  const [referenceNo, setReferenceNo] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  const billIdempotencyKeyRef =
    useRef<string | null>(null);

  const paymentIdempotencyKeyRef =
    useRef<string | null>(null);

  const tenderedAmount = Number(amount);

  const isValidAmount =
    Number.isFinite(tenderedAmount) &&
    tenderedAmount >= 0;

  const isNonCashOverpayment =
    method !== PaymentMethod.CASH &&
    tenderedAmount > order.total;

  const appliedAmount = Math.min(
    Math.max(tenderedAmount, 0),
    order.total,
  );

  const dueAmount = Math.max(
    order.total - appliedAmount,
    0,
  );

  const changeReturned =
    method === PaymentMethod.CASH
      ? Math.max(
          tenderedAmount - order.total,
          0,
        )
      : 0;

  const normalizedCustomerName = customerName.trim();
  const normalizedCustomerPhone = customerPhone.trim();
  const hasCustomerDetails =
    normalizedCustomerName.length >= 2 &&
    /^\+?[0-9][0-9\s().-]{5,28}[0-9]$/.test(normalizedCustomerPhone);

  function handleSubmit(): void {
    if (pending || !isValidAmount || isNonCashOverpayment) {
      return;
    }

    if (!hasCustomerDetails) {
      setErrorMessage("Customer name and a valid phone number are required before billing.");
      return;
    }

    setErrorMessage(null);

    const billIdempotencyKey =
      billIdempotencyKeyRef.current ??
      crypto.randomUUID();

    const paymentIdempotencyKey =
      paymentIdempotencyKeyRef.current ??
      crypto.randomUUID();

    billIdempotencyKeyRef.current =
      billIdempotencyKey;

    paymentIdempotencyKeyRef.current =
      paymentIdempotencyKey;

    startTransition(async () => {
      try {
        try {
          const offline = await createOfflineBill({
            idempotencyKey: billIdempotencyKey,
            orderId: order.id,
            subtotal: order.subtotal,
            tax: order.tax,
            discount: order.discount,
            total: order.total,
            customerName: normalizedCustomerName,
            customerPhone: normalizedCustomerPhone,
            customerAddress: customerAddress.trim() || null,
            notes: notes.trim() || null,
            payment: tenderedAmount > 0 ? {
              idempotencyKey: paymentIdempotencyKey,
              method,
              tenderedAmount,
              referenceNo: referenceNo.trim() || undefined,
            } : undefined,
          });

          billIdempotencyKeyRef.current = null;
          paymentIdempotencyKeyRef.current = null;
          router.push(`/billing/${offline.billId}`);
          router.refresh();
          return;
        } catch {
          // Fall back to the existing server action when no local session exists.
        }

        const result = await createBill({
          idempotencyKey: billIdempotencyKey,
          orderId: order.id,
          customerName: normalizedCustomerName,
          customerPhone: normalizedCustomerPhone,
          customerAddress: customerAddress.trim() || undefined,
          notes: notes.trim() || undefined,
          payment: tenderedAmount > 0 ? {
            idempotencyKey: paymentIdempotencyKey,
            method, tenderedAmount,
            referenceNo: referenceNo.trim() || undefined,
          } : undefined,
        });

        if (!result.success) {
          setErrorMessage(result.message);
          return;
        }

        billIdempotencyKeyRef.current = null;
        paymentIdempotencyKeyRef.current = null;
        router.push(`/billing/${result.billId}`);
        router.refresh();
      } catch (error: unknown) {
        console.error(
          "CREATE_BILL_CLIENT_ERROR:",
          error,
        );

        setErrorMessage(
          "The bill could not be created. Please try again.",
        );
      }
    });
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="customer-name"
              className="text-sm font-medium"
            >
              Customer Name
            </label>

            <input
              id="customer-name"
              value={customerName}
              maxLength={150}
              onChange={(event) =>
                setCustomerName(
                  event.target.value,
                )
              }
              required
              autoComplete="name"
              placeholder="Required"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="customer-phone"
              className="text-sm font-medium"
            >
              Phone
            </label>

            <input
              id="customer-phone"
              value={customerPhone}
              maxLength={30}
              required
              inputMode="tel"
              autoComplete="tel"
              onChange={(event) =>
                setCustomerPhone(
                  event.target.value,
                )
              }
              placeholder="Required"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="customer-address"
            className="text-sm font-medium"
          >
            Customer Address
          </label>

          <input
            id="customer-address"
            value={customerAddress}
            maxLength={500}
            onChange={(event) =>
              setCustomerAddress(
                event.target.value,
              )
            }
            placeholder="Optional"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <p className="text-sm font-medium">
            Payment Method
          </p>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PAYMENT_METHODS.map(
              (option) => {
                const Icon =
                  option.icon;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setMethod(
                        option.value,
                      )
                    }
                    className={`rounded-md border p-3 text-sm transition ${
                      method ===
                      option.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Icon className="mx-auto h-5 w-5" />

                    <span className="mt-1 block text-xs">
                      {option.label}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="payment-amount"
            className="text-sm font-medium"
          >
            {method ===
            PaymentMethod.CASH
              ? "Cash Tendered"
              : "Payment Amount"}
          </label>

          <input
            id="payment-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) =>
              setAmount(
                event.target.value,
              )
            }
            className="mt-1 h-12 w-full rounded-md border bg-background px-3 text-lg font-semibold outline-none focus:border-primary"
          />

          <p className="mt-1 text-xs text-muted-foreground">
            Enter 0 to create an
            unpaid bill.
          </p>
        </div>

        <div>
          <label
            htmlFor="payment-reference"
            className="text-sm font-medium"
          >
            Reference / Transaction ID
          </label>

          <input
            id="payment-reference"
            value={referenceNo}
            maxLength={150}
            onChange={(event) =>
              setReferenceNo(
                event.target.value,
              )
            }
            placeholder="Optional"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label
            htmlFor="billing-notes"
            className="text-sm font-medium"
          >
            Notes
          </label>

          <input
            id="billing-notes"
            value={notes}
            maxLength={500}
            onChange={(event) =>
              setNotes(
                event.target.value,
              )
            }
            placeholder="Optional"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="space-y-2 rounded-lg bg-muted/40 p-4 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>
              ₹
              {order.subtotal.toFixed(
                2,
              )}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Tax</span>
            <span>
              ₹{order.tax.toFixed(2)}
            </span>
          </div>

          {order.discount > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Discount</span>
              <span>
                -₹
                {order.discount.toFixed(
                  2,
                )}
              </span>
            </div>
          )}

          {changeReturned > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>
                Change Returned
              </span>
              <span>
                ₹
                {changeReturned.toFixed(
                  2,
                )}
              </span>
            </div>
          )}

          {dueAmount > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Due</span>
              <span>
                ₹
                {dueAmount.toFixed(
                  2,
                )}
              </span>
            </div>
          )}

          <div className="flex justify-between border-t pt-3 text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">
              ₹
              {order.total.toFixed(
                2,
              )}
            </span>
          </div>
        </div>

        {isNonCashOverpayment && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Non-cash payment cannot
            exceed the bill total.
          </p>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessage}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={
            pending ||
            !isValidAmount ||
            isNonCashOverpayment ||
            !hasCustomerDetails
          }
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              {tenderedAmount > 0
                ? "Create Bill & Record Payment"
                : "Create Unpaid Bill"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}