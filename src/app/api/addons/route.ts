import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/api-auth";

import {
  hasPermission,
  PERMISSIONS,
  Roles,
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

function forbidden(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message: "Forbidden",
    },
    {
      status: 403,
    },
  );
}

function serializeAddon(addon: {
  id: string;
  name: string;
  price: unknown;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: addon.id,
    name: addon.name,
    price: Number(addon.price),
    isActive: addon.isActive,
    sortOrder: addon.sortOrder,
    createdAt: addon.createdAt,
    updatedAt: addon.updatedAt,
  };
}

function isPrismaUniqueError(
  error: unknown,
): boolean {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }

  if (!("code" in error)) {
    return false;
  }

  return error.code === "P2002";
}

/**
 * GET /api/addons
 */
export async function GET(): Promise<Response> {
  try {
    const user = await getAuthUser();

    if (!user) {
      return unauthorized();
    }

    if (
      !hasPermission(
        user.role as Roles,
        PERMISSIONS.ADDON_VIEW,
      )
    ) {
      return forbidden();
    }

    const addons =
      await prisma.addon.findMany({
        where: {
          restaurantId:
            user.restaurantId,

          deletedAt: null,
        },

        select: {
          id: true,
          name: true,
          price: true,
          isActive: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
        },

        orderBy: [
          {
            sortOrder: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
      });

    return NextResponse.json({
      success: true,
      data: addons.map(
        serializeAddon,
      ),
    });
  } catch (error: unknown) {
    console.error(
      "GET /api/addons error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to fetch addons",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * POST /api/addons
 */
export async function POST(
  request: Request,
): Promise<Response> {
  try {
    const user = await getAuthUser();

    if (!user) {
      return unauthorized();
    }

    if (
      !hasPermission(
        user.role as Roles,
        PERMISSIONS.ADDON_CREATE,
      )
    ) {
      return forbidden();
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid JSON body",
        },
        {
          status: 400,
        },
      );
    }

    if (
      typeof body !== "object" ||
      body === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid request body",
        },
        {
          status: 400,
        },
      );
    }

    const payload =
      body as Record<
        string,
        unknown
      >;

    if (
      typeof payload.name !==
        "string" ||
      !payload.name.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Addon name is required",
        },
        {
          status: 400,
        },
      );
    }

    const name =
      payload.name.trim();

    if (name.length < 2) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Addon name must contain at least 2 characters",
        },
        {
          status: 400,
        },
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Addon name must not exceed 100 characters",
        },
        {
          status: 400,
        },
      );
    }

    if (
      typeof payload.price !==
        "number" ||
      !Number.isFinite(
        payload.price,
      ) ||
      payload.price < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Addon price must be a non-negative number",
        },
        {
          status: 400,
        },
      );
    }

    const price =
      payload.price;

    let isActive = true;

    if (
      payload.isActive !==
      undefined
    ) {
      if (
        typeof payload.isActive !==
        "boolean"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "isActive must be a boolean",
          },
          {
            status: 400,
          },
        );
      }

      isActive =
        payload.isActive;
    }

    let sortOrder = 0;

    if (
      payload.sortOrder !==
      undefined
    ) {
      if (
        typeof payload.sortOrder !==
          "number" ||
        !Number.isInteger(
          payload.sortOrder,
        ) ||
        payload.sortOrder < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "sortOrder must be a non-negative integer",
          },
          {
            status: 400,
          },
        );
      }

      sortOrder =
        payload.sortOrder;
    }

    const addon =
      await prisma.addon.create({
        data: {
          name,
          price,
          isActive,
          sortOrder,

          restaurantId:
            user.restaurantId,
        },

        select: {
          id: true,
          name: true,
          price: true,
          isActive: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    return NextResponse.json(
      {
        success: true,
        data:
          serializeAddon(
            addon,
          ),
      },
      {
        status: 201,
      },
    );
  } catch (error: unknown) {
    if (
      isPrismaUniqueError(
        error,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Addon name already exists",
        },
        {
          status: 409,
        },
      );
    }

    console.error(
      "POST /api/addons error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to create addon",
      },
      {
        status: 500,
      },
    );
  }
}