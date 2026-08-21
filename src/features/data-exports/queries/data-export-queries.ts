import type {
  Prisma,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

import type {
  DataExportHistoryItemDto,
} from "../types";

function isJsonObject(
  value:
    | Prisma.JsonValue
    | null,
): value is Prisma.JsonObject {
  return (
    value !== null &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
  );
}

function readString(
  value: unknown,
): string | null {
  return typeof value ===
    "string"
    ? value
    : null;
}

function readNumber(
  value: unknown,
): number | null {
  return typeof value ===
      "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function readRowCounts(
  value: unknown,
): Record<
  string,
  number
> | null {
  if (
    value === null ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const result: Record<
    string,
    number
  > = {};

  for (
    const [
      key,
      count,
    ] of Object.entries(
      value,
    )
  ) {
    if (
      typeof count ===
        "number" &&
      Number.isFinite(count)
    ) {
      result[key] =
        count;
    }
  }

  return result;
}

export async function getDataExportHistory(
  restaurantId: string,
): Promise<
  DataExportHistoryItemDto[]
> {
  const rows =
    await prisma.dataExport.findMany({
      where: {
        restaurantId,
      },

      select: {
        id: true,
        exportNumber: true,

        type: true,
        format: true,
        status: true,

        filters: true,

        fileName: true,
        fileUrl: true,
        errorMessage: true,

        completedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,

        requestedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },

      orderBy: {
        createdAt:
          "desc",
      },

      take: 100,
    });

  return rows.map(
    (row) => {
      const filters =
        isJsonObject(
          row.filters,
        )
          ? row.filters
          : null;

      return {
        id:
          row.id,

        exportNumber:
          row.exportNumber,

        type:
          row.type,

        format:
          row.format,

        status:
          row.status,

        fileName:
          row.fileName,

        fileUrl:
          row.fileUrl,

        errorMessage:
          row.errorMessage,

        requestedByName:
          row.requestedBy
            ?.name ?? null,

        requestedByEmail:
          row.requestedBy
            ?.email ?? null,

        sha256:
          filters
            ? readString(
                filters.sha256,
              )
            : null,

        totalRows:
          filters
            ? readNumber(
                filters.totalRows,
              )
            : null,

        rowCounts:
          filters
            ? readRowCounts(
                filters.rowCounts,
              )
            : null,

        completedAt:
          row.completedAt
            ?.toISOString() ??
          null,

        expiresAt:
          row.expiresAt
            ?.toISOString() ??
          null,

        createdAt:
          row.createdAt.toISOString(),

        updatedAt:
          row.updatedAt.toISOString(),
      };
    },
  );
}