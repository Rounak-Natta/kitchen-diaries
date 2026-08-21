import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/api-auth";

import {
  hasPermission,
  PERMISSIONS,
  Roles,
} from "@/lib/rbac";

import {
  getOrderItemsForDisplay,
} from "@/features/orders/queries/get-orders";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    orderId: string;
  }>;
}

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

function notFound(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "Order not found.",
    },
    {
      status: 404,
    },
  );
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
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

    const { orderId } =
      await context.params;

    if (
      typeof orderId !== "string" ||
      !orderId.trim()
    ) {
      return notFound();
    }

    const items =
      await getOrderItemsForDisplay(
        user.restaurantId,
        orderId,
      );

    if (!items) {
      return notFound();
    }

    return NextResponse.json(
      {
        success: true,
        data: items,
      },
      {
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error(
      "GET /api/orders/[orderId]/items error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to load order items.",
      },
      {
        status: 500,
      },
    );
  }
}