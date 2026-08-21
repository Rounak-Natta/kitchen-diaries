import {
  NextResponse,
} from "next/server";

import {
  getAuthUser,
} from "@/lib/api-auth";

import {
  pullSyncOperations,
} from "@/features/sync/lib/pull-sync-operations";

import { decodeSyncCursor } from "@/lib/local-db/sync-cursor";
import { authorizeSyncDevice } from "@/features/sync/lib/authorize-sync-device";
import { prisma } from "@/lib/prisma";

export const dynamic =
  "force-dynamic";

// ======================================================
// GET /api/sync/pull
// ======================================================

export async function GET(
  request: Request,
): Promise<Response> {
  try {
    const user =
      await getAuthUser();

    if (!user) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Unauthorized",
        },
        {
          status:
            401,
        },
      );
    }

    const url =
      new URL(
        request.url,
      );

    const cursor =
      url.searchParams.get(
        "cursor",
      ) ??
      undefined;

    const deviceId =
      request.headers.get("x-device-id")?.trim() || undefined;

    if (deviceId) {
      const device = await authorizeSyncDevice({
        deviceId,
        restaurantId: user.restaurantId,
      });

      if (!device) {
        return NextResponse.json(
          { success: false, error: "Invalid or inactive device." },
          { status: 403 },
        );
      }

      await prisma.device.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      });
    }

    const limitParam =
      url.searchParams.get(
        "limit",
      );

    let limit =
      100;

    if (limitParam) {
      const parsed =
        Number(
          limitParam,
        );

      if (
        !Number.isInteger(
          parsed,
        ) ||
        parsed < 1 ||
        parsed > 500
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Invalid limit.",
          },
          {
            status:
              400,
          },
        );
      }

      limit =
        parsed;
    }

    if (cursor && !decodeSyncCursor(cursor)) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Invalid cursor.",
        },
        {
          status:
            400,
        },
      );
    }

    const result =
      await pullSyncOperations({
        restaurantId:
          user.restaurantId,

        cursor,

        limit,
      });

    return NextResponse.json(
      {
        success:
          true,

        data:
          result,
      },
      {
        status:
          200,
      },
    );
  } catch (
    error: unknown
  ) {
    console.error(
      "GET /api/sync/pull error:",
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          "Failed to pull sync operations.",
      },
      {
        status:
          500,
      },
    );
  }
}