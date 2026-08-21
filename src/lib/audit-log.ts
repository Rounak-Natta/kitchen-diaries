import { Prisma } from "@prisma/client";

type AuditDatabaseClient = Pick<
  Prisma.TransactionClient,
  "auditLog"
>;

export interface WriteAuditLogInput {
  restaurantId: string;
  userId?: string | null;

  module: string;
  action: string;

  entityType?: string | null;
  entityId?: string | null;

  oldData?: unknown;
  newData?: unknown;

  reason?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();

  return normalized || null;
}

function serializeAuditData(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  const serialized = JSON.stringify(
    value,
    (
      _key,
      currentValue: unknown,
    ) => {
      if (
        currentValue instanceof
        Prisma.Decimal
      ) {
        return currentValue.toString();
      }

      if (
        typeof currentValue ===
        "bigint"
      ) {
        return currentValue.toString();
      }

      if (
        currentValue instanceof Date
      ) {
        return currentValue.toISOString();
      }

      return currentValue;
    },
  );

  if (serialized === undefined) {
    return undefined;
  }

  return JSON.parse(
    serialized,
  ) as Prisma.InputJsonValue;
}

export async function writeAuditLog(
  database: AuditDatabaseClient,
  input: WriteAuditLogInput,
): Promise<void> {
  const restaurantId =
    input.restaurantId.trim();

  const moduleName =
    input.module.trim();

  const actionName =
    input.action.trim();

  if (!restaurantId) {
    throw new Error(
      "Restaurant ID is required for audit logging.",
    );
  }

  if (!moduleName) {
    throw new Error(
      "Audit module is required.",
    );
  }

  if (!actionName) {
    throw new Error(
      "Audit action is required.",
    );
  }

  await database.auditLog.create({
    data: {
      restaurantId,

      userId:
        input.userId ?? null,

      module: moduleName,
      action: actionName,

      entityType:
        normalizeOptionalText(
          input.entityType,
        ),

      entityId:
        normalizeOptionalText(
          input.entityId,
        ),

      oldData:
        serializeAuditData(
          input.oldData,
        ),

      newData:
        serializeAuditData(
          input.newData,
        ),

      reason:
        normalizeOptionalText(
          input.reason,
        ),

      requestId:
        normalizeOptionalText(
          input.requestId,
        ),

      ipAddress:
        normalizeOptionalText(
          input.ipAddress,
        ),

      userAgent:
        normalizeOptionalText(
          input.userAgent,
        ),
    },
  });
}