import type { Prisma } from "@prisma/client";

export type OrderNotificationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "BILLED"
  | "COMPLETED"
  | "CANCELLED";

const STATUS_LABELS: Record<OrderNotificationStatus, string> = {
  PENDING: "New",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  BILLED: "Billed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function formatNotificationStatus(status: string): string {
  return STATUS_LABELS[status as OrderNotificationStatus] ?? status.replaceAll("_", " ");
}

export async function createOrderLifecycleNotifications(
  tx: Prisma.TransactionClient,
  input: {
    restaurantId: string;
    orderId: string;
    orderNumber: string;
    status: OrderNotificationStatus;
    version: number;
    actorUserId?: string;
    eventType?: "ORDER_CREATED" | "ORDER_STATUS_CHANGED";
  },
): Promise<void> {
  const users = await tx.user.findMany({
    where: {
      restaurantId: input.restaurantId,
      isActive: true,
    },
    select: { id: true },
  });

  if (users.length === 0) return;

  const label = formatNotificationStatus(input.status);
  const isCreated = input.eventType === "ORDER_CREATED";
  const title = isCreated ? "New order created" : `Order ${label}`;
  const message = isCreated
    ? `${input.orderNumber} is ready for confirmation.`
    : `${input.orderNumber} moved to ${label}.`;

  const dedupeKey = `ORDER:${input.orderId}:V${input.version}:${input.status}`;

  await tx.notification.createMany({
    data: users.map((user) => ({
      restaurantId: input.restaurantId,
      userId: user.id,
      type: isCreated ? "ORDER_CREATED" : "ORDER_LIFECYCLE",
      title,
      message,
      entityType: "ORDER",
      entityId: input.orderId,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      status: input.status,
      dedupeKey,
    })),
    skipDuplicates: true,
  });
}
