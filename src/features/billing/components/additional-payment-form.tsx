"use client";

import {
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
} from "lucide-react";

import {
  addPaymentToBill,
} from "../actions/billing-actions";
import { addOfflinePayment } from "@/lib/local-db/offline-billing";
import type {
  PaymentMethodValue,
} from "../types";

interface AdditionalPaymentFormProps {
  billId: string;
  dueAmount: number;
}

interface PaymentMethodOption {
  value: PaymentMethodValue;
  label: string;
}

const PAYMENT_METHODS: PaymentMethodOption[] =
  [
    {
      value: "CASH",
      label: "Cash",
    },
    {
      value: "UPI",
      label: "UPI",
    },
    {
      value: "CARD",
      label: "Card",
    },
    {
      value: "WALLET",
      label: "Wallet",
    },
    {
      value: "BANK_TRANSFER",
      label: "Bank",
    },
  ];

function parseAmount(
  value: string,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

export function AdditionalPaymentForm({
  billId,
  dueAmount,
}: AdditionalPaymentFormProps) {
  const router = useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [method, setMethod] =
    useState<PaymentMethodValue>(
      "CASH",
    );

  const [amount, setAmount] =
    useState<string>(
      dueAmount.toFixed(2),
    );

  const [
    referenceNo,
    setReferenceNo,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const idempotencyKeyRef =
    useRef<string | null>(null);

  const tenderedAmount =
    parseAmount(amount);

  const isValidAmount =
    tenderedAmount > 0;

  const isNonCashOverpayment =
    method !== "CASH" &&
    tenderedAmount > dueAmount;

  const expectedChange =
    method === "CASH"
      ? Math.max(
          tenderedAmount -
            dueAmount,
          0,
        )
      : 0;

  function handleMethodChange(
    nextMethod: PaymentMethodValue,
  ): void {
    setMethod(nextMethod);
    setErrorMessage(null);
  }

  function handleSubmit(): void {
    if (
      pending ||
      !isValidAmount
    ) {
      return;
    }

    if (isNonCashOverpayment) {
      setErrorMessage(
        "Non-cash payment cannot exceed the due amount.",
      );

      return;
    }

    setErrorMessage(null);

    const idempotencyKey =
      idempotencyKeyRef.current ??
      crypto.randomUUID();

    idempotencyKeyRef.current =
      idempotencyKey;

    startTransition(async () => {
      try {
        try {
          await addOfflinePayment({
            billId,
            method,
            tenderedAmount,
            referenceNo: referenceNo.trim() || undefined,
            idempotencyKey,
          });
          idempotencyKeyRef.current = null;
          router.refresh();
          return;
        } catch {
          // Fall back to the server action for sessions without a local database.
        }

        const result = await addPaymentToBill(billId, {
          idempotencyKey, method, tenderedAmount,
          referenceNo: referenceNo.trim() || undefined,
          notes: notes.trim() || undefined,
        });

        if (!result.success) {
          setErrorMessage(result.message);
          return;
        }

        idempotencyKeyRef.current = null;
        router.refresh();
      } catch (error: unknown) {
        console.error(
          "ADD_PAYMENT_CLIENT_ERROR:",
          error,
        );

        setErrorMessage(
          "The payment could not be submitted. Please try again.",
        );
      }
    });
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <header>
        <h3 className="text-lg font-semibold">
          Record Additional Payment
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">
          Outstanding amount: ₹
          {dueAmount.toFixed(2)}
        </p>
      </header>

      <div className="mt-5 space-y-4">
        <div>
          <p className="text-sm font-medium">
            Payment method
          </p>

          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PAYMENT_METHODS.map(
              (option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    handleMethodChange(
                      option.value,
                    )
                  }
                  disabled={pending}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    method ===
                    option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {option.label}
                </button>
              ),
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="additional-payment-amount"
            className="text-sm font-medium"
          >
            {method === "CASH"
              ? "Cash tendered"
              : "Payment amount"}
          </label>

          <input
            id="additional-payment-amount"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={amount}
            disabled={pending}
            onChange={(event) => {
              setAmount(
                event.target.value,
              );

              setErrorMessage(
                null,
              );
            }}
            className="mt-1 h-12 w-full rounded-md border bg-background px-3 text-lg font-semibold outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {expectedChange > 0 && (
          <div className="flex justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            <span>
              Change to return
            </span>

            <span>
              ₹
              {expectedChange.toFixed(
                2,
              )}
            </span>
          </div>
        )}

        {isNonCashOverpayment && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Non-cash payment cannot
            exceed the due amount.
          </p>
        )}

        <div>
          <label
            htmlFor="payment-reference"
            className="text-sm font-medium"
          >
            Reference / Transaction ID
          </label>

          <input
            id="payment-reference"
            type="text"
            value={referenceNo}
            maxLength={150}
            disabled={pending}
            onChange={(event) =>
              setReferenceNo(
                event.target.value,
              )
            }
            placeholder="Optional"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="payment-notes"
            className="text-sm font-medium"
          >
            Payment notes
          </label>

          <textarea
            id="payment-notes"
            value={notes}
            maxLength={500}
            rows={3}
            disabled={pending}
            onChange={(event) =>
              setNotes(
                event.target.value,
              )
            }
            placeholder="Optional"
            className="mt-1 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

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
            isNonCashOverpayment
          }
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Record Payment
            </>
          )}
        </button>
      </div>
    </section>
  );
}