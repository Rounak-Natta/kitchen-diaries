import {
  z,
} from "zod";

// ======================================================
// SYNC PUSH OPERATION
// ======================================================

export const syncPushOperationSchema =
  z.object({
    operationId:
      z.string()
        .min(1)
        .max(100),

    deviceId:
      z.string()
        .min(1)
        .max(100),

    restaurantId:
      z.string()
        .min(1)
        .max(100),

    entityType:
      z.string()
        .min(1)
        .max(50),

    entityId:
      z.string()
        .min(1)
        .max(100),

    operationType:
      z.string()
        .min(1)
        .max(50),

    // Version of the entity known by the
    // offline client when the operation was created.
    baseVersion:
      z.number()
        .int()
        .min(0)
        .optional(),

    payload:
      z.unknown(),
  });

export type SyncPushOperation =
  z.infer<
    typeof syncPushOperationSchema
  >;

// ======================================================
// SYNC PUSH REQUEST
// ======================================================

export const syncPushRequestSchema =
  z.object({
    operations:
      z.array(
        syncPushOperationSchema,
      )
      .min(0)
      .max(50),
  });

export type SyncPushRequest =
  z.infer<
    typeof syncPushRequestSchema
  >;