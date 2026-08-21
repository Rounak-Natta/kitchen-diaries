import {
  NextResponse,
} from "next/server";

import {
  getAuthUser,
} from "@/lib/api-auth";

import {
  prisma,
} from "@/lib/prisma";

import {
  acknowledgeSyncOperations,
} from "@/features/sync/lib/acknowledge-sync-operations";

export const dynamic =
  "force-dynamic";

// ======================================================
// POST /api/sync/ack
// ======================================================

export async function POST(
  request: Request,
): Promise<Response> {
  try {
    // --------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------

    const user =
      await getAuthUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    // --------------------------------------------------
    // REQUEST BODY
    // --------------------------------------------------

    const body =
      await request.json();

    if (
      !body ||
      typeof body !==
        "object"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Invalid request body.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      operationIds,
      deviceId,
    } =
      body as {
        operationIds?: unknown;

        deviceId?: unknown;
      };

    // --------------------------------------------------
    // VALIDATE DEVICE ID
    // --------------------------------------------------

    if (
      typeof deviceId !==
        "string" ||
      deviceId.trim()
        .length === 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "deviceId is required.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // VALIDATE OPERATION IDS
    // --------------------------------------------------

    if (
      !Array.isArray(
        operationIds,
      ) ||
      operationIds.length >
        100
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "operationIds must be an array containing at most 100 items.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      operationIds.some(
        (
          operationId,
        ) =>
          typeof operationId !==
          "string",
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "All operationIds must be strings.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // VERIFY DEVICE
    // --------------------------------------------------

    const device =
      await prisma.device.findFirst({
        where: {
          id:
            deviceId,

          restaurantId:
            user.restaurantId,

          status:
            "ACTIVE",
        },

        select: {
          id: true,
        },
      });

    if (!device) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Invalid or inactive device.",
        },
        {
          status: 403,
        },
      );
    }

    // --------------------------------------------------
    // ACKNOWLEDGE
    // --------------------------------------------------

    const result =
      await acknowledgeSyncOperations({
        operationIds:
          operationIds as string[],

        deviceId:
          device.id,

        restaurantId:
          user.restaurantId,
      });

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: true,

        data: result,
      },
      {
        status: 200,
      },
    );
  } catch (
    error: unknown
  ) {
    console.error(
      "POST /api/sync/ack error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "Failed to acknowledge sync operations.",
      },
      {
        status: 500,
      },
    );
  }
}