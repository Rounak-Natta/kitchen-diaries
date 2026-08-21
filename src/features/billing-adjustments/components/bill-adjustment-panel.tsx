"use client";

import {
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Ban,
  Loader2,
  RotateCcw,
} from "lucide-react";
import {
  useRouter,
} from "next/navigation";

import {
  cancelBill,
  refundBill,
} from "../actions/billing-adjustment-actions";
import type {
  BillAdjustmentDataDto,
} from "../queries/billing-adjustment-queries";

interface BillAdjustmentPanelProps {
  bill: BillAdjustmentDataDto;
  canCancel: boolean;
  canRefund: boolean;
}

const PAYMENT_METHODS = [
  {
    value: "CASH",
    label: "Cash",
  },
  {
    value: "CARD",
    label: "Card",
  },
  {
    value: "UPI",
    label: "UPI",
  },
  {
    value: "WALLET",
    label: "Wallet",
  },
  {
    value: "BANK_TRANSFER",
    label: "Bank Transfer",
  },
] as const;

type RefundMethod =
  (typeof PAYMENT_METHODS)[number]["value"];

export function BillAdjustmentPanel({
  bill,
  canCancel,
  canRefund,
}: BillAdjustmentPanelProps) {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    cancellationReason,
    setCancellationReason,
  ] = useState("");

  const [refundAmount, setRefundAmount] =
    useState(
      bill.refundableAmount.toFixed(
        2,
      ),
    );

  const [refundMethod, setRefundMethod] =
    useState<RefundMethod>("CASH");

  const [
    refundReason,
    setRefundReason,
  ] = useState("");

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

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(
    null,
  );

  const refundIdempotencyKeyRef =
    useRef<string | null>(null);

  const refundAmountNumber =
    Number(refundAmount);

  const canCancelCurrentBill =
    canCancel &&
    bill.status === "ACTIVE" &&
    bill.refundableAmount <= 0;

  const canRefundCurrentBill =
    canRefund &&
    bill.dueAmount <= 0 &&
    bill.refundableAmount > 0 &&
    (
      bill.status === "ACTIVE" ||
      bill.status ===
        "PARTIALLY_REFUNDED"
    );

  function handleCancellation(): void {
    if (
      pending ||
      !canCancelCurrentBill ||
      cancellationReason
        .trim().length < 3
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Cancel this bill and reverse its inventory deduction?",
      );

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result =
        await cancelBill(
          bill.id,
          {
            reason:
              cancellationReason.trim(),
          },
        );

      if (!result.success) {
        setErrorMessage(
          result.error,
        );

        return;
      }

      setSuccessMessage(
        result.message,
      );

      router.refresh();
    });
  }

  function handleRefund(): void {
    if (
      pending ||
      !canRefundCurrentBill ||
      !Number.isFinite(
        refundAmountNumber,
      ) ||
      refundAmountNumber <= 0 ||
      refundAmountNumber >
        bill.refundableAmount ||
      refundReason.trim().length <
        3
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Record a refund of ₹${refundAmountNumber.toFixed(
          2,
        )}?`,
      );

    if (!confirmed) {
      return;
    }

    const idempotencyKey =
      refundIdempotencyKeyRef.current ??
      crypto.randomUUID();

    refundIdempotencyKeyRef.current =
      idempotencyKey;

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result =
        await refundBill(
          bill.id,
          {
            idempotencyKey,

            amount:
              refundAmountNumber,

            method:
              refundMethod,

            reason:
              refundReason.trim(),

            referenceNo:
              referenceNo.trim() ||
              undefined,

            notes:
              notes.trim() ||
              undefined,
          },
        );

      if (!result.success) {
        setErrorMessage(
          result.error,
        );

        return;
      }

      refundIdempotencyKeyRef.current =
        null;

      setSuccessMessage(
        result.message,
      );

      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {canRefundCurrentBill && (
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <RotateCcw className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold">
                Record Refund
              </h2>

              <p className="text-sm text-muted-foreground">
                Refundable amount: ₹
                {bill.refundableAmount.toFixed(
                  2,
                )}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="refund-amount"
                className="text-sm font-medium"
              >
                Refund Amount
              </label>

              <input
                id="refund-amount"
                type="number"
                min="0.01"
                max={
                  bill.refundableAmount
                }
                step="0.01"
                value={
                  refundAmount
                }
                disabled={pending}
                onChange={(event) =>
                  setRefundAmount(
                    event.target
                      .value,
                  )
                }
                className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label
                htmlFor="refund-method"
                className="text-sm font-medium"
              >
                Refund Method
              </label>

              <select
                id="refund-method"
                value={
                  refundMethod
                }
                disabled={pending}
                onChange={(event) =>
                  setRefundMethod(
                    event.target
                      .value as RefundMethod,
                  )
                }
                className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                {PAYMENT_METHODS.map(
                  (method) => (
                    <option
                      key={
                        method.value
                      }
                      value={
                        method.value
                      }
                    >
                      {method.label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="refund-reason"
                className="text-sm font-medium"
              >
                Refund Reason
              </label>

              <textarea
                id="refund-reason"
                value={
                  refundReason
                }
                rows={3}
                maxLength={500}
                disabled={pending}
                onChange={(event) =>
                  setRefundReason(
                    event.target
                      .value,
                  )
                }
                className="mt-1 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label
                htmlFor="refund-reference"
                className="text-sm font-medium"
              >
                Reference Number
              </label>

              <input
                id="refund-reference"
                value={
                  referenceNo
                }
                maxLength={150}
                disabled={pending}
                onChange={(event) =>
                  setReferenceNo(
                    event.target
                      .value,
                  )
                }
                placeholder="Optional"
                className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label
                htmlFor="refund-notes"
                className="text-sm font-medium"
              >
                Notes
              </label>

              <input
                id="refund-notes"
                value={notes}
                maxLength={500}
                disabled={pending}
                onChange={(event) =>
                  setNotes(
                    event.target
                      .value,
                  )
                }
                placeholder="Optional"
                className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="mt-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            Refunds are financial
            records. They do not add
            prepared ingredients back
            into inventory.
          </div>

          <button
            type="button"
            onClick={handleRefund}
            disabled={
              pending ||
              !Number.isFinite(
                refundAmountNumber,
              ) ||
              refundAmountNumber <=
                0 ||
              refundAmountNumber >
                bill.refundableAmount ||
              refundReason
                .trim().length < 3
            }
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-amber-600 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}

            Record Refund
          </button>
        </section>
      )}

      {canCancelCurrentBill && (
        <section className="rounded-xl border border-red-200 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-red-100 text-red-700">
              <Ban className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold">
                Cancel Bill
              </h2>

              <p className="text-sm text-muted-foreground">
                Inventory deductions
                will be reversed.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor="cancellation-reason"
              className="text-sm font-medium"
            >
              Cancellation Reason
            </label>

            <textarea
              id="cancellation-reason"
              value={
                cancellationReason
              }
              rows={3}
              maxLength={500}
              disabled={pending}
              onChange={(event) =>
                setCancellationReason(
                  event.target
                    .value,
                )
              }
              className="mt-1 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-red-500"
            />
          </div>

          <button
            type="button"
            onClick={
              handleCancellation
            }
            disabled={
              pending ||
              cancellationReason
                .trim().length < 3
            }
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-destructive text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Ban className="h-4 w-4" />
            )}

            Cancel Bill and Restore
            Inventory
          </button>
        </section>
      )}

      {!canRefundCurrentBill &&
        !canCancelCurrentBill && (
          <section className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
            No cancellation or refund
            action is currently
            available for this bill.
          </section>
        )}

      {successMessage && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
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
    </div>
  );
}