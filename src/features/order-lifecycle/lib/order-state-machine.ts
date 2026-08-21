import type {
  OrderLifecycleStatus,
} from "../types";

const MANUAL_TRANSITIONS: Record<
  OrderLifecycleStatus,
  readonly OrderLifecycleStatus[]
> = {
  PENDING: [
    "CONFIRMED",
  ],

  CONFIRMED: [
    "PREPARING",
  ],

  PREPARING: [
    "READY",
  ],

  READY: [],
  BILLED: [],
  COMPLETED: [],
  CANCELLED: [],
};

const CANCELLABLE_STATUSES:
  readonly OrderLifecycleStatus[] =
  [
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "READY",
  ];

export function getAllowedManualOrderTransitions(
  currentStatus: OrderLifecycleStatus,
): readonly OrderLifecycleStatus[] {
  return (
    MANUAL_TRANSITIONS[
      currentStatus
    ] ?? []
  );
}

export function canCancelOrderStatus(
  status: OrderLifecycleStatus,
): boolean {
  return CANCELLABLE_STATUSES.includes(
    status,
  );
}

export function formatOrderStatus(
  status: string,
): string {
  return status
    .toLowerCase()
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}