import {
  InventoryTransactionType,
  OrderStatus,
  Prisma,
} from "@prisma/client";

import {
  processCreateOrder,
} from "./process-create-order";
import {
  processCreateBill,
  processAddPayment,
  processRefundBill,
  processCancelBill,
} from "./process-create-bill";
import { postInventoryTransaction } from "@/features/inventory/services/inventory-transaction-service";
import { getBusinessDate } from "@/lib/business-date";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createOrderLifecycleNotifications } from "@/features/notifications/lib/notification-service";
import { canCancelOrderStatus, getAllowedManualOrderTransitions } from "@/features/order-lifecycle/lib/order-state-machine";
import type { OrderLifecycleStatus } from "@/features/order-lifecycle/types";
import type { Role } from "@prisma/client";

// ======================================================
// TYPES
// ======================================================

export interface ProcessSyncOperationInput {
  operationId: string;

  operationType: string;

  baseVersion?: number;

  entityType: string;

  entityId: string;

  payload: unknown;

  restaurantId: string;

  userId: string;
  role?: Role;
}

export interface ProcessSyncOperationResult {
  status:
    | "COMPLETED"
    | "FAILED";

  response:
    | Prisma.JsonValue
    | null;

  error:
    | string
    | null;
}

// ======================================================
// JSON HELPER
// ======================================================

function toJsonValue(
  value: unknown,
): Prisma.JsonValue {
  return value as Prisma.JsonValue;
}

function requiredPermissionForOperation(
  input: ProcessSyncOperationInput,
): Parameters<typeof hasPermission>[1] | null {
  if (input.entityType === "ORDER") {
    if (input.operationType === "CREATE") return PERMISSIONS.ORDERS_CREATE;
    if (input.operationType === "UPDATE") {
      const payload =
        input.payload && typeof input.payload === "object"
          ? input.payload as Record<string, unknown>
          : {};
      if (payload.status === "CANCELLED") return PERMISSIONS.ORDERS_CANCEL;
      if (typeof payload.status === "string") return PERMISSIONS.ORDERS_STATUS_UPDATE;
      return PERMISSIONS.ORDERS_UPDATE;
    }
    return PERMISSIONS.ORDERS_UPDATE;
  }
  if (input.entityType === "BILL") {
    if (input.operationType === "CREATE") return PERMISSIONS.BILLING_CREATE;
    if (input.operationType === "ADD_PAYMENT") return PERMISSIONS.BILLING_PAYMENT_ADD;
    if (input.operationType === "REFUND") return PERMISSIONS.BILLING_REFUND;
    if (input.operationType === "CANCEL") return PERMISSIONS.BILLING_CANCEL;
  }
  if (input.entityType === "INVENTORY_TRANSACTION") {
    return PERMISSIONS.INVENTORY_ADJUST;
  }
  return null;
}

// ======================================================
// PROCESS SYNC OPERATION
// ======================================================

export async function processSyncOperation(
  tx: Prisma.TransactionClient,
  input: ProcessSyncOperationInput,
): Promise<ProcessSyncOperationResult> {
  try {
    if (input.role) {
      const permission = requiredPermissionForOperation(input);
      if (permission && !hasPermission(input.role, permission)) {
        throw new Error("FORBIDDEN_SYNC_OPERATION");
      }
    }

    // --------------------------------------------------
    // CREATE ORDER
    // --------------------------------------------------

    if (
      input.entityType ===
        "ORDER" &&
      input.operationType ===
        "CREATE"
    ) {
      const result =
        await processCreateOrder(
          tx,
          input.payload,
          {
            userId:
              input.userId,

            restaurantId:
              input.restaurantId,
          },
        );

      return {
        status:
          "COMPLETED",

        response:
          toJsonValue(
            result,
          ),

        error:
          null,
      };
    }

    // --------------------------------------------------
    // CREATE BILL
    // --------------------------------------------------

    if (
      input.entityType === "BILL" &&
      input.operationType === "CREATE"
    ) {
      const result = await processCreateBill(
        tx,
        input.payload,
        {
          userId: input.userId,
          restaurantId: input.restaurantId,
        },
      );

      return {
        status: "COMPLETED",
        response: toJsonValue(result),
        error: null,
      };
    }

    // --------------------------------------------------
    // ADD PAYMENT TO BILL
    // --------------------------------------------------

    if (
      input.entityType === "BILL" &&
      input.operationType === "ADD_PAYMENT"
    ) {
      const payload = input.payload as Record<string, unknown>;
      const result = await processAddPayment(
        tx,
        payload,
        {
          userId: input.userId,
          restaurantId: input.restaurantId,
        },
      );

      return {
        status: "COMPLETED",
        response: toJsonValue(result),
        error: null,
      };
    }

    // --------------------------------------------------
    // REFUND BILL
    // --------------------------------------------------

    if (
      input.entityType === "BILL" &&
      input.operationType === "REFUND"
    ) {
      const result = await processRefundBill(
        tx,
        input.payload,
        {
          userId: input.userId,
          restaurantId: input.restaurantId,
        },
      );

      return {
        status: "COMPLETED",
        response: toJsonValue(result),
        error: null,
      };
    }

    // --------------------------------------------------
    // CANCEL BILL
    // --------------------------------------------------

    if (
      input.entityType === "BILL" &&
      input.operationType === "CANCEL"
    ) {
      const result = await processCancelBill(
        tx,
        input.payload,
        {
          userId: input.userId,
          restaurantId: input.restaurantId,
        },
      );

      return {
        status: "COMPLETED",
        response: toJsonValue(result),
        error: null,
      };
    }

    // --------------------------------------------------
    // INVENTORY TRANSACTION
    // --------------------------------------------------

    if (
      input.entityType === "INVENTORY_TRANSACTION" &&
      input.operationType === "CREATE"
    ) {
      const payload = input.payload as Record<string, unknown>;
      const inventoryItemId = typeof payload.inventoryItemId === "string" ? payload.inventoryItemId : "";
      const typeValue = typeof payload.type === "string" ? payload.type : "";
      const quantity = typeof payload.quantity === "number" ? payload.quantity : Number(payload.quantity);
      const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : undefined;
      const createdAt =
        typeof payload._createdAt === "string"
          ? new Date(payload._createdAt)
          : new Date();
      if (Number.isNaN(createdAt.getTime())) {
        throw new Error("Invalid offline inventory timestamp.");
      }
      const businessDate =
        typeof payload._businessDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(payload._businessDate)
          ? new Date(`${payload._businessDate}T00:00:00.000Z`)
          : getBusinessDate(createdAt);

      if (!inventoryItemId || !typeValue || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Invalid inventory transaction.");
      }

      const type = InventoryTransactionType[typeValue as keyof typeof InventoryTransactionType];
      if (!type) throw new Error("Invalid inventory transaction type.");

      const positiveTypes = new Set<InventoryTransactionType>([
        InventoryTransactionType.STOCK_IN,
        InventoryTransactionType.ADJUSTMENT_IN,
        InventoryTransactionType.OPENING_STOCK,
        InventoryTransactionType.RESTORE,
        InventoryTransactionType.CUSTOMER_RETURN,
      ]);
      const sign = positiveTypes.has(type) ? 1 : -1;

      const result = await postInventoryTransaction(tx, {
        restaurantId: input.restaurantId,
        createdById: input.userId,
        inventoryItemId,
        type,
        quantityChange: sign * quantity,
        unitCost: typeof payload.unitCost === "number" ? payload.unitCost : undefined,
        idempotencyKey,
        reason: typeof payload.reason === "string" ? payload.reason : undefined,
        referenceType: "OFFLINE_SYNC",
        referenceId: input.operationId,
        businessDate,
      });

      return {
        status: "COMPLETED",
        response: toJsonValue({
          inventoryTransactionId: result.id,
          transactionNumber: result.transactionNumber,
          stockAfter: result.stockAfter.toString(),
        }),
        error: null,
      };
    }

    // --------------------------------------------------
    // UPDATE ORDER
    // --------------------------------------------------

    if (
      input.entityType === "ORDER" &&
      input.operationType === "UPDATE"
    ) {
      const payload = input.payload as Record<string, unknown>;
      const idempotencyKey =
        typeof payload.idempotencyKey === "string" && payload.idempotencyKey.trim()
          ? payload.idempotencyKey
          : undefined;

      const current = await tx.order.findFirst({
        where: {
          restaurantId: input.restaurantId,
          OR: [
            { id: input.entityId },
            ...(idempotencyKey ? [{ idempotencyKey }] : []),
          ],
        },
        select: {
          id: true,
          orderNumber: true,
          version: true,
          status: true,
          inventoryStatus: true,
          bill: { select: { id: true } },
        },
      });

      if (!current) throw new Error("Order was not found.");
      if (
        typeof input.baseVersion === "number" &&
        current.version !== input.baseVersion
      ) {
        throw new Error(
          `SYNC_CONFLICT: Order version is ${current.version}; client baseVersion was ${input.baseVersion}.`,
        );
      }

      const rawStatus =
        typeof payload.status === "string" ? payload.status : undefined;

      if (!rawStatus) {
        throw new Error("Order status is required.");
      }

      const nextStatus = rawStatus as OrderStatus;

      if (nextStatus === "CANCELLED") {
        if (current.bill) {
          throw new Error("Billed orders must be cancelled through billing workflows.");
        }
        if (!canCancelOrderStatus(current.status as OrderLifecycleStatus)) {
          throw new Error(`Orders with status ${current.status} cannot be cancelled directly.`);
        }
      } else {
        const allowedTransitions = getAllowedManualOrderTransitions(current.status as OrderLifecycleStatus);
        if (!allowedTransitions.includes(rawStatus as OrderLifecycleStatus)) {
          throw new Error(`Order cannot move from ${current.status} to ${rawStatus}.`);
        }
      }

      if (
        current.inventoryStatus !== "NOT_DEDUCTED"
      ) {
        throw new Error("The order inventory state is inconsistent. Review order reconciliation.");
      }

      const lifecycleTimestamp = new Date();

      const updated = await tx.order.update({
        where: { id: current.id },
        data: {
          status: nextStatus,
          ...(nextStatus === "CONFIRMED" ? { confirmedAt: lifecycleTimestamp } : {}),
          ...(nextStatus === "PREPARING" ? { preparingAt: lifecycleTimestamp } : {}),
          ...(nextStatus === "READY" ? { readyAt: lifecycleTimestamp } : {}),
          ...(nextStatus === "CANCELLED"
            ? {
                cancelledAt: lifecycleTimestamp,
                cancellationReason:
                  typeof payload.cancellationReason === "string"
                    ? payload.cancellationReason
                    : null,
              }
            : {}),
          ...(typeof payload.tableNumber === "string" ? { tableNumber: payload.tableNumber } : {}),
          ...(typeof payload.notes === "string" ? { notes: payload.notes } : {}),
          version: { increment: 1 },
        },
        select: { id: true, orderNumber: true, version: true, status: true },
      });

      await createOrderLifecycleNotifications(tx, {
        restaurantId: input.restaurantId,
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        status: updated.status,
        version: updated.version,
        actorUserId: input.userId,
        eventType: "ORDER_STATUS_CHANGED",
      });

      return {
        status: "COMPLETED",
        response: toJsonValue(updated),
        error: null,
      };
    }

    // --------------------------------------------------
    // UNSUPPORTED OPERATION
    // --------------------------------------------------

    throw new Error(
      `Unsupported sync operation: ${input.operationType} ${input.entityType}.`,
    );
  } catch (
    error: unknown
  ) {
    // --------------------------------------------------
    // NORMALIZE ERROR
    // --------------------------------------------------

    return {
      status:
        "FAILED",

      response:
        null,

      error:
        error instanceof Error
          ? error.message
          : "Sync operation failed.",
    };
  }
}