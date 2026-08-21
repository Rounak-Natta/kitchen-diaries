import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
  Roles,
} from "@/lib/rbac";

import {
  getOrdersForList,
} from "@/features/orders/queries/get-orders";

export const dynamic = "force-dynamic";

function unauthorized(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "Unauthorized",
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
      error: message,
    },
    {
      status: 403,
    },
  );
}

export async function GET(): Promise<Response> {
  try {
    const user = await getAuthUser();

    if (!user) {
      return unauthorized();
    }

    if (
      !hasPermission(
        user.role as Roles,
        PERMISSIONS.ORDERS_READ,
      )
    ) {
      return forbidden();
    }

    if (!user.restaurantId) {
      return forbidden(
        "No restaurant assigned.",
      );
    }

    const orders =
      await getOrdersForList(
        user.restaurantId,
      );

    return NextResponse.json(
      {
        success: true,
        data: orders,
      },
      {
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error(
      "GET /api/orders error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load orders.",
      },
      {
        status: 500,
      },
    );
  }
}