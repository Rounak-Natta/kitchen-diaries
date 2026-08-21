"use server";

import {
  BillStatus,
  InventoryStatus,
  OrderStatus,
} from "@prisma/client";
import {
  revalidatePath,
} from "next/cache";

import {
  writeAuditLog,
} from "@/lib/audit-log";
import { createOrderLifecycleNotifications } from "@/features/notifications/lib/notification-service";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
  type Permission,
} from "@/lib/rbac";
import {
  withSerializableTransaction,
} from "@/lib/transaction";
import { recordUserBug } from "@/lib/system-event";

import {
  canCancelOrderStatus,
  getAllowedManualOrderTransitions,
} from "../lib/order-state-machine";
import type {
  OrderLifecycleStatus,
} from "../types";
import {
  cancelOrderSchema,
  reconcileOrderSchema,
  updateOrderLifecycleSchema,
  type CancelOrderInput,
  type ReconcileOrderInput,
  type UpdateOrderLifecycleInput,
} from "../validations/order-lifecycle-schemas";

export type OrderLifecycleActionResult =
  | {
      success: true;

      orderId: string;
      status: OrderLifecycleStatus;
      version: number;

      message: string;
    }
  | {
      success: false;
      error: string;
    };

class OrderLifecycleError extends Error {}

interface OrderActor {
  id: string;
  restaurantId: string;
}

async function requireOrderActor(
  permission: Permission,
): Promise<OrderActor> {
  const user =
    await getAuthUser();

  if (!user) {
    throw new OrderLifecycleError(
      "Unauthorized.",
    );
  }

  if (
    !hasPermission(
      user.role,
      permission,
    )
  ) {
    throw new OrderLifecycleError(
      "You do not have permission to perform this order operation.",
    );
  }

  if (!user.restaurantId) {
    throw new OrderLifecycleError(
      "No restaurant is assigned to this user.",
    );
  }

  return {
    id: user.id,

    restaurantId:
      user.restaurantId,
  };
}

function getLifecycleError(
  error: unknown,
): string {
  if (
    error instanceof
    OrderLifecycleError
  ) {
    return error.message;
  }

  return "The order operation could not be completed.";
}


async function logLifecycleBug(
  source: string,
  actor: OrderActor | null,
  orderId: string,
  error: unknown,
): Promise<void> {
  await recordUserBug({
    severity: error instanceof OrderLifecycleError ? "WARN" : "ERROR",
    source,
    message:
      error instanceof Error
        ? error.message
        : "Unexpected order lifecycle failure.",
    restaurantId: actor?.restaurantId ?? null,
    metadata: {
      userId: actor?.id,
      orderId,
      path: `/orders/${orderId}/lifecycle`,
      errorName: error instanceof Error ? error.name : "UnknownError",
      stack: error instanceof Error ? error.stack : undefined,
    },
  });
}

function revalidateOrderPaths(
  orderId: string,
): void {
  revalidatePath(
    "/orders",
  );

  revalidatePath(
    `/orders/${orderId}`,
  );

  revalidatePath(
    `/orders/${orderId}/lifecycle`,
  );

  revalidatePath(
    "/orders/reconciliation",
  );

  revalidatePath(
    "/billing",
  );
}

export async function updateOrderLifecycle(
  orderId: string,
  data: UpdateOrderLifecycleInput,
): Promise<OrderLifecycleActionResult> {
  let actorForBug: OrderActor | null = null;

  try {
    const actor =
      await requireOrderActor(
        PERMISSIONS.ORDERS_STATUS_UPDATE,
      );

    actorForBug = actor;

    const validation =
      updateOrderLifecycleSchema.safeParse(
        data,
      );

    if (!validation.success) {
      return {
        success: false,

        error:
          validation.error.issues[0]
            ?.message ??
          "Invalid order status information.",
      };
    }

    const input =
      validation.data;

    const changedAt =
      new Date();

    const result =
      await withSerializableTransaction(
        async (transaction) => {
          const order =
            await transaction.order.findFirst({
              where: {
                id: orderId,

                restaurantId:
                  actor.restaurantId,
              },

              select: {
                id: true,
                orderNumber: true,

                status: true,
                inventoryStatus: true,
                version: true,

                confirmedAt: true,
                preparingAt: true,
                readyAt: true,

                bill: {
                  select: {
                    id: true,
                  },
                },
              },
            });

          if (!order) {
            throw new OrderLifecycleError(
              "Order was not found.",
            );
          }

          if (order.bill) {
            throw new OrderLifecycleError(
              "Billed orders must be managed through billing and payment workflows.",
            );
          }

          if (
            order.inventoryStatus !==
            InventoryStatus.NOT_DEDUCTED
          ) {
            throw new OrderLifecycleError(
              "The order inventory state is inconsistent. Review order reconciliation.",
            );
          }

          const allowedTransitions =
            getAllowedManualOrderTransitions(
              order.status,
            );

          if (
            !allowedTransitions.includes(
              input.targetStatus,
            )
          ) {
            throw new OrderLifecycleError(
              `Order cannot move from ${order.status} to ${input.targetStatus}.`,
            );
          }

          const targetStatus =
            input.targetStatus as OrderStatus;

          const statusTimestamps =
            targetStatus ===
            OrderStatus.CONFIRMED
              ? {
                  confirmedAt:
                    changedAt,
                }
              : targetStatus ===
                  OrderStatus.PREPARING
                ? {
                    preparingAt:
                      changedAt,
                  }
                : {
                    readyAt:
                      changedAt,
                  };

          const updateResult =
            await transaction.order.updateMany({
              where: {
                id: order.id,

                restaurantId:
                  actor.restaurantId,

                version:
                  input.expectedVersion,

                status:
                  order.status,
              },

              data: {
                status:
                  targetStatus,

                ...statusTimestamps,

                version: {
                  increment: 1,
                },
              },
            });

          if (
            updateResult.count !== 1
          ) {
            throw new OrderLifecycleError(
              "The order changed in another session. Refresh and try again.",
            );
          }

          const updatedOrder =
            await transaction.order.findUniqueOrThrow({
              where: {
                id: order.id,
              },

              select: {
                id: true,
                status: true,
                version: true,
              },
            });

          await writeAuditLog(
            transaction,
            {
              restaurantId:
                actor.restaurantId,

              userId:
                actor.id,

              module: "ORDERS",

              action:
                "UPDATE_ORDER_STATUS",

              entityType:
                "Order",

              entityId:
                order.id,

              oldData: {
                orderNumber:
                  order.orderNumber,

                status:
                  order.status,

                version:
                  order.version,

                confirmedAt:
                  order.confirmedAt
                    ?.toISOString() ??
                  null,

                preparingAt:
                  order.preparingAt
                    ?.toISOString() ??
                  null,

                readyAt:
                  order.readyAt
                    ?.toISOString() ??
                  null,
              },

              newData: {
                orderNumber:
                  order.orderNumber,

                status:
                  updatedOrder.status,

                version:
                  updatedOrder.version,

                changedAt:
                  changedAt.toISOString(),
              },
            },
          );

          await createOrderLifecycleNotifications(transaction, {
            restaurantId: actor.restaurantId,
            orderId: updatedOrder.id,
            orderNumber: order.orderNumber,
            status: updatedOrder.status as OrderLifecycleStatus,
            version: updatedOrder.version,
            actorUserId: actor.id,
            eventType: "ORDER_STATUS_CHANGED",
          });

          return updatedOrder;
        },
      );

    revalidateOrderPaths(
      orderId,
    );

    return {
      success: true,

      orderId:
        result.id,

      status:
        result.status,

      version:
        result.version,

      message:
        `Order moved to ${result.status}.`,
    };
  } catch (error: unknown) {
    console.error(
      "UPDATE_ORDER_LIFECYCLE_ERROR:",
      error,
    );

    await logLifecycleBug(
      "ORDER_LIFECYCLE",
      actorForBug,
      orderId,
      error,
    );

    return {
      success: false,

      error:
        getLifecycleError(
          error,
        ),
    };
  }
}

export async function cancelOrder(
  orderId: string,
  data: CancelOrderInput,
): Promise<OrderLifecycleActionResult> {
  let actorForBug: OrderActor | null = null;

  try {
    const actor =
      await requireOrderActor(
        PERMISSIONS.ORDERS_CANCEL,
      );

    actorForBug = actor;

    const validation =
      cancelOrderSchema.safeParse(
        data,
      );

    if (!validation.success) {
      return {
        success: false,

        error:
          validation.error.issues[0]
            ?.message ??
          "Invalid cancellation information.",
      };
    }

    const input =
      validation.data;

    const cancelledAt =
      new Date();

    const result =
      await withSerializableTransaction(
        async (transaction) => {
          const order =
            await transaction.order.findFirst({
              where: {
                id: orderId,

                restaurantId:
                  actor.restaurantId,
              },

              select: {
                id: true,
                orderNumber: true,

                status: true,
                inventoryStatus: true,
                version: true,

                cancelledAt: true,
                cancellationReason: true,

                bill: {
                  select: {
                    id: true,
                    billNumber: true,
                    status: true,
                  },
                },
              },
            });

          if (!order) {
            throw new OrderLifecycleError(
              "Order was not found.",
            );
          }

          if (
            order.status ===
            OrderStatus.CANCELLED
          ) {
            return {
              id: order.id,

              status:
                order.status,

              version:
                order.version,

              alreadyCancelled:
                true,
            };
          }

          if (order.bill) {
            throw new OrderLifecycleError(
              `Order already has bill ${order.bill.billNumber}. Use Bill Adjustments instead.`,
            );
          }

          if (
            !canCancelOrderStatus(
              order.status,
            )
          ) {
            throw new OrderLifecycleError(
              `Orders with status ${order.status} cannot be cancelled directly.`,
            );
          }

          if (
            order.inventoryStatus !==
            InventoryStatus.NOT_DEDUCTED
          ) {
            throw new OrderLifecycleError(
              "Inventory has already been processed for this order. Review order reconciliation.",
            );
          }

          const updateResult =
            await transaction.order.updateMany({
              where: {
                id: order.id,

                restaurantId:
                  actor.restaurantId,

                version:
                  input.expectedVersion,

                status:
                  order.status,
              },

              data: {
                status:
                  OrderStatus.CANCELLED,

                cancelledAt,

                cancellationReason:
                  input.reason,

                cancelledById:
                  actor.id,

                completedAt: null,

                version: {
                  increment: 1,
                },
              },
            });

          if (
            updateResult.count !== 1
          ) {
            throw new OrderLifecycleError(
              "The order changed in another session. Refresh and try again.",
            );
          }

          const cancelledOrder =
            await transaction.order.findUniqueOrThrow({
              where: {
                id: order.id,
              },

              select: {
                id: true,
                status: true,
                version: true,
              },
            });

          await writeAuditLog(
            transaction,
            {
              restaurantId:
                actor.restaurantId,

              userId:
                actor.id,

              module: "ORDERS",
              action:
                "CANCEL_ORDER",

              entityType:
                "Order",

              entityId:
                order.id,

              oldData: {
                orderNumber:
                  order.orderNumber,

                status:
                  order.status,

                inventoryStatus:
                  order.inventoryStatus,

                version:
                  order.version,
              },

              newData: {
                orderNumber:
                  order.orderNumber,

                status:
                  cancelledOrder.status,

                inventoryStatus:
                  order.inventoryStatus,

                version:
                  cancelledOrder.version,

                cancelledAt:
                  cancelledAt.toISOString(),

                cancellationReason:
                  input.reason,

                inventoryRestored:
                  false,

                inventoryRestorationReason:
                  "Inventory was not deducted before billing.",
              },

              reason:
                input.reason,
            },
          );

          return {
            ...cancelledOrder,

            alreadyCancelled:
              false,
          };
        },
      );

    revalidateOrderPaths(
      orderId,
    );

    return {
      success: true,

      orderId:
        result.id,

      status:
        result.status,

      version:
        result.version,

      message:
        result.alreadyCancelled
          ? "Order is already cancelled."
          : "Order cancelled successfully.",
    };
  } catch (error: unknown) {
    console.error(
      "CANCEL_ORDER_ERROR:",
      error,
    );

    await logLifecycleBug(
      "ORDER_CANCEL",
      actorForBug,
      orderId,
      error,
    );

    return {
      success: false,

      error:
        getLifecycleError(
          error,
        ),
    };
  }
}

export async function reconcileOrderFromBill(
  orderId: string,
  data: ReconcileOrderInput,
): Promise<OrderLifecycleActionResult> {
  let actorForBug: OrderActor | null = null;

  try {
    const actor =
      await requireOrderActor(
        PERMISSIONS.ORDERS_UPDATE,
      );

    actorForBug = actor;

    const validation =
      reconcileOrderSchema.safeParse(
        data,
      );

    if (!validation.success) {
      return {
        success: false,

        error:
          validation.error.issues[0]
            ?.message ??
          "Invalid reconciliation request.",
      };
    }

    const reconciledAt =
      new Date();

    const result =
      await withSerializableTransaction(
        async (transaction) => {
          const order =
            await transaction.order.findFirst({
              where: {
                id: orderId,

                restaurantId:
                  actor.restaurantId,
              },

              select: {
                id: true,
                orderNumber: true,

                status: true,
                inventoryStatus: true,
                version: true,

                billedAt: true,
                completedAt: true,

                bill: {
                  select: {
                    id: true,
                    billNumber: true,

                    status: true,
                    paymentStatus: true,

                    dueAmount: true,

                    createdAt: true,
                    paidAt: true,
                    inventoryPostedAt: true,
                  },
                },
              },
            });

          if (!order) {
            throw new OrderLifecycleError(
              "Order was not found.",
            );
          }

          const bill =
            order.bill;

          if (!bill) {
            throw new OrderLifecycleError(
              "This order has no bill and cannot be reconciled automatically.",
            );
          }

          if (
            order.status ===
              OrderStatus.CANCELLED ||
            bill.status ===
              BillStatus.CANCELLED
          ) {
            throw new OrderLifecycleError(
              "Cancelled order and bill inconsistencies require manual review.",
            );
          }

          if (
            order.inventoryStatus ===
              InventoryStatus.RESTORED ||
            order.inventoryStatus ===
              InventoryStatus.PARTIALLY_RESTORED
          ) {
            throw new OrderLifecycleError(
              "Restored inventory cannot be reconciled automatically against an active bill.",
            );
          }

          if (
            !bill.inventoryPostedAt &&
            order.inventoryStatus ===
              InventoryStatus.DEDUCTED
          ) {
            throw new OrderLifecycleError(
              "Inventory deduction metadata is inconsistent and requires manual review.",
            );
          }

          const targetStatus =
            bill.dueAmount.lte(0)
              ? OrderStatus.COMPLETED
              : OrderStatus.BILLED;

          const targetInventoryStatus =
            bill.inventoryPostedAt &&
            order.inventoryStatus ===
              InventoryStatus.NOT_DEDUCTED
              ? InventoryStatus.DEDUCTED
              : order.inventoryStatus;

          const statusChanged =
            order.status !==
            targetStatus;

          const inventoryChanged =
            order.inventoryStatus !==
            targetInventoryStatus;

          if (
            !statusChanged &&
            !inventoryChanged
          ) {
            return {
              id: order.id,

              status:
                order.status,

              version:
                order.version,

              changed: false,
            };
          }

          const updateResult =
            await transaction.order.updateMany({
              where: {
                id: order.id,

                restaurantId:
                  actor.restaurantId,

                // Reconciliation is an authoritative repair operation. Use the
                // version read inside this same serializable transaction so a
                // background sync between page render and click does not make
                // every repair stale. updateMany still protects against a
                // concurrent write that happens after this read.
                version:
                  order.version,
              },

              data: {
                status:
                  targetStatus,

                inventoryStatus:
                  targetInventoryStatus,

                billedAt:
                  order.billedAt ??
                  bill.createdAt,

                completedAt:
                  targetStatus ===
                  OrderStatus.COMPLETED
                    ? order.completedAt ??
                      bill.paidAt ??
                      bill.createdAt
                    : null,

                version: {
                  increment: 1,
                },
              },
            });

          if (
            updateResult.count !== 1
          ) {
            throw new OrderLifecycleError(
              "The order changed in another session. Refresh and try again.",
            );
          }

          const updatedOrder =
            await transaction.order.findUniqueOrThrow({
              where: {
                id: order.id,
              },

              select: {
                id: true,
                status: true,
                inventoryStatus: true,
                version: true,
              },
            });

          await writeAuditLog(
            transaction,
            {
              restaurantId:
                actor.restaurantId,

              userId:
                actor.id,

              module: "ORDERS",

              action:
                "RECONCILE_ORDER_FROM_BILL",

              entityType:
                "Order",

              entityId:
                order.id,

              oldData: {
                orderNumber:
                  order.orderNumber,

                status:
                  order.status,

                inventoryStatus:
                  order.inventoryStatus,

                version:
                  order.version,
              },

              newData: {
                orderNumber:
                  order.orderNumber,

                billId:
                  bill.id,

                billNumber:
                  bill.billNumber,

                billStatus:
                  bill.status,

                paymentStatus:
                  bill.paymentStatus,

                status:
                  updatedOrder.status,

                inventoryStatus:
                  updatedOrder.inventoryStatus,

                version:
                  updatedOrder.version,

                reconciledAt:
                  reconciledAt.toISOString(),
              },

              reason:
                "Order state reconciled from authoritative bill state.",
            },
          );

          return {
            id:
              updatedOrder.id,

            status:
              updatedOrder.status,

            version:
              updatedOrder.version,

            changed: true,
          };
        },
      );

    revalidateOrderPaths(
      orderId,
    );

    return {
      success: true,

      orderId:
        result.id,

      status:
        result.status,

      version:
        result.version,

      message:
        result.changed
          ? "Order reconciled successfully."
          : "Order is already consistent with its bill.",
    };
  } catch (error: unknown) {
    console.error(
      "RECONCILE_ORDER_FROM_BILL_ERROR:",
      error,
    );

    await logLifecycleBug(
      "ORDER_RECONCILE",
      actorForBug,
      orderId,
      error,
    );

    return {
      success: false,

      error:
        getLifecycleError(
          error,
        ),
    };
  }
}