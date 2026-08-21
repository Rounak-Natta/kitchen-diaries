import {
  createHash,
} from "node:crypto";
import {
  Buffer,
} from "node:buffer";

import {
  NextResponse,
} from "next/server";
import {
  revalidatePath,
} from "next/cache";

import {
  stringifyExportJson,
} from "@/features/data-exports/lib/json-export";
import {
  buildFullDataExportSnapshot,
  completeFullDataExport,
  failFullDataExport,
  startFullDataExport,
} from "@/features/data-exports/services/full-data-export-service";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function isAllowedOrigin(
  request: Request,
): boolean {
  const fetchSite =
    request.headers.get(
      "sec-fetch-site",
    );

  if (
    fetchSite ===
    "cross-site"
  ) {
    return false;
  }

  const origin =
    request.headers.get(
      "origin",
    );

  if (!origin) {
    return true;
  }

  try {
    const requestUrl =
      new URL(
        request.url,
      );

    const originUrl =
      new URL(origin);

    return (
      requestUrl.host ===
      originUrl.host
    );
  } catch {
    return false;
  }
}

function safeExportError(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message
      .trim()
      .slice(
        0,
        1000,
      );
  }

  return "The export failed unexpectedly.";
}

export async function POST(
  request: Request,
): Promise<Response> {
  if (
    !isAllowedOrigin(
      request,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Cross-site export requests are not allowed.",
      },
      {
        status: 403,
      },
    );
  }

  const user =
    await getAuthUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.DATA_EXPORT,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to export restaurant data.",
      },
      {
        status: 403,
      },
    );
  }

  if (!user.restaurantId) {
    return NextResponse.json(
      {
        error:
          "No restaurant is assigned to this user.",
      },
      {
        status: 403,
      },
    );
  }

  let startedExport:
    | Awaited<
        ReturnType<
          typeof startFullDataExport
        >
      >
    | null = null;

  try {
    startedExport =
      await startFullDataExport({
        id:
          user.id,

        restaurantId:
          user.restaurantId,

        name:
          user.name,

        email:
          user.email,

        role:
          user.role,
      });

    const generatedAt =
      new Date();

    const {
      snapshot,
      rowCounts,
      totalRows,
    } =
      await buildFullDataExportSnapshot(
        {
          id:
            user.id,

          restaurantId:
            user.restaurantId,

          name:
            user.name,

          email:
            user.email,

          role:
            user.role,
        },

        startedExport.id,
        startedExport.exportNumber,
        generatedAt,
      );

    const json =
      stringifyExportJson(
        snapshot,
      );

    const sha256 =
      createHash(
        "sha256",
      )
        .update(
          json,
          "utf8",
        )
        .digest(
          "hex",
        );

    const fileName =
      `kitchen-diaries-full-backup-${startedExport.exportNumber}.json`;

    await completeFullDataExport({
      exportId:
        startedExport.id,

      exportNumber:
        startedExport.exportNumber,

      restaurantId:
        user.restaurantId,

      requestedById:
        user.id,

      fileName,
      sha256,
      generatedAt,
      rowCounts,
      totalRows,
    });

    revalidatePath(
      "/data-exports",
    );

    return new Response(
      json,
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json; charset=utf-8",

          "Content-Disposition":
            `attachment; filename="${fileName}"`,

          "Content-Length":
            Buffer.byteLength(
              json,
              "utf8",
            ).toString(),

          "Cache-Control":
            "no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",

          "X-Export-Number":
            startedExport.exportNumber,

          "X-Export-SHA256":
            sha256,
        },
      },
    );
  } catch (error: unknown) {
    console.error(
      "FULL_DATA_EXPORT_ERROR:",
      error,
    );

    if (startedExport) {
      try {
        await failFullDataExport(
          startedExport.id,
          user.restaurantId,
          user.id,
          startedExport.exportNumber,
          safeExportError(
            error,
          ),
        );
      } catch (
        statusError: unknown
      ) {
        console.error(
          "MARK_DATA_EXPORT_FAILED_ERROR:",
          statusError,
        );
      }
    }

    revalidatePath(
      "/data-exports",
    );

    return NextResponse.json(
      {
        error:
          "The full backup could not be generated. Review the export history and try again.",
      },
      {
        status: 500,
      },
    );
  }
}