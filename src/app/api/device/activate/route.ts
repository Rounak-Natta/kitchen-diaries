import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/api-auth";

import {
  activateExistingCustomer,
} from "@/lib/subscription/restaurant-activation";

interface ActivateRestaurantRequest {
  code?: unknown;
  deviceKey?: unknown;
  deviceName?: unknown;
}

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonResponse(
  body: unknown,
  status: number,
): Response {
  return NextResponse.json(
    body,
    {
      status,
      headers: noStoreHeaders(),
    },
  );
}

export async function POST(
  request: Request,
): Promise<Response> {
  try {
    /*
     * --------------------------------------------------
     * 1. Authentication
     * --------------------------------------------------
     */

    const authUser = await getAuthUser();

    if (!authUser) {
      return jsonResponse(
        {
          success: false,
          error: "Authentication required.",
        },
        401,
      );
    }

    /*
     * --------------------------------------------------
     * 2. Parse request body
     * --------------------------------------------------
     */

    let body: ActivateRestaurantRequest;

    try {
      body =
        (await request.json()) as ActivateRestaurantRequest;
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "Invalid JSON request body.",
        },
        400,
      );
    }

    /*
     * --------------------------------------------------
     * 3. Validate activation code
     * --------------------------------------------------
     */

    if (
      typeof body.code !== "string" ||
      !body.code.trim()
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Activation code is required.",
        },
        400,
      );
    }

    /*
     * --------------------------------------------------
     * 4. Validate device key
     * --------------------------------------------------
     */

    if (
      typeof body.deviceKey !== "string" ||
      !body.deviceKey.trim()
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Device key is required.",
        },
        400,
      );
    }

    /*
     * --------------------------------------------------
     * 5. Validate optional device name
     * --------------------------------------------------
     */

    if (
      body.deviceName !== undefined &&
      body.deviceName !== null &&
      typeof body.deviceName !== "string"
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Device name must be a string.",
        },
        400,
      );
    }

    /*
     * --------------------------------------------------
     * 6. Normalize validated input
     * --------------------------------------------------
     */

    const code = body.code.trim();

    const deviceKey =
      body.deviceKey.trim();

    const deviceName =
      typeof body.deviceName === "string"
        ? body.deviceName.trim() || undefined
        : undefined;

    /*
     * --------------------------------------------------
     * 7. Activate restaurant
     *
     * The service is responsible for:
     * - validating the activation code
     * - creating the subscription
     * - creating the device
     * - consuming the activation code
     * - transaction rollback
     * --------------------------------------------------
     */

    const result =
      await activateExistingCustomer({
        code,

        restaurantId:
          authUser.restaurantId,

        userId:
          authUser.id,

        deviceKey,

        deviceName,
      });

    /*
     * --------------------------------------------------
     * 8. Success response
     * --------------------------------------------------
     *
     * IMPORTANT:
     * restaurantId is intentionally returned on the
     * subscription as well as the device.
     */

    return jsonResponse(
      {
        success: true,

        subscription: {
          id:
            result.subscription.id,

          restaurantId:
            result.subscription.restaurantId,

          plan:
            result.subscription.plan,

          status:
            result.subscription.status,

          startsAt:
            result.subscription.startsAt,

          expiresAt:
            result.subscription.expiresAt,

          maxDevices:
            result.subscription.maxDevices,
        },

        device: {
          id:
            result.device.id,

          restaurantId:
            result.device.restaurantId,

          status:
            result.device.status,

          name:
            result.device.name,

          activatedAt:
            result.device.activatedAt,
        },
      },
      200,
    );
 } catch (error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Restaurant activation failed.";

  return jsonResponse(
    {
      success: false,
      error: message,
    },
    400,
  );
}
}