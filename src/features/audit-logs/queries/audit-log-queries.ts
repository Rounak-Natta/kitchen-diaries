import {
  Prisma,
} from "@prisma/client";

import {
  resolveReportRange,
} from "@/features/reports/lib/report-range";
import { prisma } from "@/lib/prisma";

import type {
  AuditLogDetailDto,
  AuditLogFiltersInput,
  AuditLogListResultDto,
} from "../types";

const AUDIT_LOG_PAGE_SIZE = 50;

function normalizeFilter(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizePage(
  value:
    | number
    | undefined,
): number {
  if (
    value === undefined ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    return 1;
  }

  return value;
}

function stringifyJson(
  value:
    | Prisma.JsonValue
    | null,
): string | null {
  if (value === null) {
    return null;
  }

  return JSON.stringify(
    value,
    null,
    2,
  );
}

export async function getAuditLogList(
  restaurantId: string,
  input: AuditLogFiltersInput,
): Promise<AuditLogListResultDto> {
  const moduleFilter =
    normalizeFilter(
      input.module,
    );

  const actionFilter =
    normalizeFilter(
      input.action,
    );

  const userIdFilter =
    normalizeFilter(
      input.userId,
    );

  const query =
    normalizeFilter(
      input.query,
    );

  const rangeInput: {
    from?: string;
    to?: string;
  } = {};

  if (input.from) {
    rangeInput.from =
      input.from;
  }

  if (input.to) {
    rangeInput.to =
      input.to;
  }

  const range =
    resolveReportRange(
      rangeInput,
    );

  const where:
    Prisma.AuditLogWhereInput = {
    restaurantId,

    createdAt: {
      gte:
        range.transactionStartUtc,

      lt:
        range.transactionEndExclusiveUtc,
    },
  };

  if (moduleFilter) {
    where.module =
      moduleFilter;
  }

  if (actionFilter) {
    where.action =
      actionFilter;
  }

  if (userIdFilter) {
    where.userId =
      userIdFilter;
  }

  if (query) {
    where.OR = [
      {
        module: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        action: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        entityType: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        entityId: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        reason: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        requestId: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        user: {
          is: {
            OR: [
              {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          },
        },
      },
    ];
  }

  const totalRows =
    await prisma.auditLog.count({
      where,
    });

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalRows /
          AUDIT_LOG_PAGE_SIZE,
      ),
    );

  const requestedPage =
    normalizePage(
      input.page,
    );

  const page =
    Math.min(
      requestedPage,
      totalPages,
    );

  const actionOptionsWhere:
    Prisma.AuditLogWhereInput = {
    restaurantId,
  };

  if (moduleFilter) {
    actionOptionsWhere.module =
      moduleFilter;
  }

  const [
    auditLogs,
    moduleRows,
    actionRows,
    users,
  ] = await Promise.all([
    prisma.auditLog.findMany({
      where,

      select: {
        id: true,

        module: true,
        action: true,

        entityType: true,
        entityId: true,

        reason: true,
        requestId: true,

        oldData: true,
        newData: true,

        createdAt: true,

        userId: true,

        user: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },

      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],

      skip:
        (page - 1) *
        AUDIT_LOG_PAGE_SIZE,

      take:
        AUDIT_LOG_PAGE_SIZE,
    }),

    prisma.auditLog.findMany({
      where: {
        restaurantId,
      },

      select: {
        module: true,
      },

      distinct: [
        "module",
      ],

      orderBy: {
        module: "asc",
      },
    }),

    prisma.auditLog.findMany({
      where:
        actionOptionsWhere,

      select: {
        action: true,
      },

      distinct: [
        "action",
      ],

      orderBy: {
        action: "asc",
      },
    }),

    prisma.user.findMany({
      where: {
        restaurantId,

        auditLogs: {
          some: {},
        },
      },

      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },

      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return {
    range: {
      from: range.from,
      to: range.to,

      dayCount:
        range.dayCount,

      warning:
        range.warning,
    },

    filters: {
      module:
        moduleFilter,

      action:
        actionFilter,

      userId:
        userIdFilter,

      query,

      page,
    },

    options: {
      modules:
        moduleRows.map(
          (row) =>
            row.module,
        ),

      actions:
        actionRows.map(
          (row) =>
            row.action,
        ),

      users:
        users.map(
          (user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }),
        ),
    },

    rows:
      auditLogs.map(
        (log) => ({
          id: log.id,

          module:
            log.module,

          action:
            log.action,

          entityType:
            log.entityType,

          entityId:
            log.entityId,

          reason:
            log.reason,

          requestId:
            log.requestId,

          userId:
            log.userId,

          userName:
            log.user?.name ??
            null,

          userEmail:
            log.user?.email ??
            null,

          userRole:
            log.user?.role ??
            null,

          hasOldData:
            log.oldData !==
            null,

          hasNewData:
            log.newData !==
            null,

          createdAt:
            log.createdAt.toISOString(),
        }),
      ),

    pagination: {
      page,
      pageSize:
        AUDIT_LOG_PAGE_SIZE,

      totalRows,
      totalPages,
    },
  };
}

export async function getAuditLogDetail(
  restaurantId: string,
  auditLogId: string,
): Promise<AuditLogDetailDto | null> {
  const auditLog =
    await prisma.auditLog.findFirst({
      where: {
        id: auditLogId,
        restaurantId,
      },

      select: {
        id: true,

        module: true,
        action: true,

        entityType: true,
        entityId: true,

        oldData: true,
        newData: true,

        reason: true,
        ipAddress: true,
        userAgent: true,
        requestId: true,

        createdAt: true,
        userId: true,

        user: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

  if (!auditLog) {
    return null;
  }

  return {
    id:
      auditLog.id,

    module:
      auditLog.module,

    action:
      auditLog.action,

    entityType:
      auditLog.entityType,

    entityId:
      auditLog.entityId,

    reason:
      auditLog.reason,

    oldData:
      stringifyJson(
        auditLog.oldData,
      ),

    newData:
      stringifyJson(
        auditLog.newData,
      ),

    ipAddress:
      auditLog.ipAddress,

    userAgent:
      auditLog.userAgent,

    requestId:
      auditLog.requestId,

    userId:
      auditLog.userId,

    userName:
      auditLog.user?.name ??
      null,

    userEmail:
      auditLog.user?.email ??
      null,

    userRole:
      auditLog.user?.role ??
      null,

    createdAt:
      auditLog.createdAt.toISOString(),
  };
}