"use client";

import {
  Loader2,
  RefreshCcw,
} from "lucide-react";
import {
  useTransition,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  reconcileOrderFromBill,
} from "../actions/order-lifecycle-actions";

interface OrderReconcileButtonProps {
  orderId: string;
  orderNumber: string;
  expectedVersion: number;
}

export function OrderReconcileButton({
  orderId,
  orderNumber,
  expectedVersion,
}: OrderReconcileButtonProps) {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  function handleReconcile(): void {
    if (pending) {
      return;
    }

    const confirmed =
      window.confirm(
        `Reconcile ${orderNumber} using its bill as the authoritative state?`,
      );

    if (!confirmed) {
      return;
    }

    startTransition(
      async () => {
        const result =
          await reconcileOrderFromBill(
            orderId,
            {
              expectedVersion,
            },
          );

        if (!result.success) {
          window.alert(
            result.error,
          );

          return;
        }

        router.refresh();
      },
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleReconcile}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCcw className="h-4 w-4" />
      )}

      Reconcile
    </button>
  );
}