import Link from "next/link";
import {
  Ban,
  RotateCcw,
} from "lucide-react";

interface BillAdjustmentLinkProps {
  billId: string;

  status:
    | "ACTIVE"
    | "CANCELLED"
    | "PARTIALLY_REFUNDED"
    | "REFUNDED";

  canCancel: boolean;
  canRefund: boolean;
}

export function BillAdjustmentLink({
  billId,
  status,
  canCancel,
  canRefund,
}: BillAdjustmentLinkProps) {
  const hasAdjustmentAccess =
    canCancel || canRefund;

  if (!hasAdjustmentAccess) {
    return null;
  }

  if (
    status === "CANCELLED" ||
    status === "REFUNDED"
  ) {
    return (
      <Link
        href={`/billing/${billId}/adjustments`}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-card px-4 text-sm font-medium transition hover:bg-muted"
      >
        <RotateCcw className="h-4 w-4" />
        View Adjustments
      </Link>
    );
  }

  return (
    <Link
      href={`/billing/${billId}/adjustments`}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
    >
      {status ===
      "PARTIALLY_REFUNDED" ? (
        <RotateCcw className="h-4 w-4" />
      ) : (
        <Ban className="h-4 w-4" />
      )}

      {status ===
      "PARTIALLY_REFUNDED"
        ? "Manage Refund"
        : "Cancel / Refund"}
    </Link>
  );
}