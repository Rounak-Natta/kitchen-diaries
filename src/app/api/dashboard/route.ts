import { NextResponse } from "next/server";

import {
  getAuthUser,
} from "@/lib/api-auth";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

function unauthorized(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message: "Unauthorized",
    },
    {
      status: 401,
    },
  );
}

function forbidden(
  message = "Forbidden",
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status: 403,
    },
  );
}

export async function GET(): Promise<Response> {
  try {
    const user =
      await getAuthUser();

    if (!user) {
      return unauthorized();
    }

    if (
      !hasPermission(
        user.role,
        PERMISSIONS.ANALYTICS_READ,
      )
    ) {
      return forbidden();
    }

    if (!user.restaurantId) {
      return forbidden(
        "No restaurant is assigned to this user.",
      );
    }

    return NextResponse.json({
      success: true,

      data: {
        id: user.id,

        restaurantId:
          user.restaurantId,

        name: user.name,

        email: user.email,

        role: user.role,
      },
    });
  } catch (error: unknown) {
    console.error(
      "GET /api/dashboard error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Internal server error",
      },
      {
        status: 500,
      },
    );
  }
}