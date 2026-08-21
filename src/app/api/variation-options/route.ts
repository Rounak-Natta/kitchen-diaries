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

function isPrismaUniqueError(
  error: unknown,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function serializeOption(option: {
  id: string;
  name: string;
  description: string | null;
  price: unknown;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
}) {
  return {
    id: option.id,
    name: option.name,
    description: option.description,
    price: Number(option.price),
    sortOrder: option.sortOrder,
    isDefault: option.isDefault,
    isActive: option.isActive,
  };
}

/**
 * POST /api/variation-options
 *
 * Creates a variation option belonging
 * to a variation group owned by the
 * authenticated restaurant.
 */
export async function POST(
  request: Request,
): Promise<Response> {
  try {
    const user =
      await getAuthUser();

    if (!user) {
      return unauthorized();
    }

    if (
      !hasPermission(
        user.role as Roles,
        PERMISSIONS.MENU_CREATE,
      )
    ) {
      return forbidden();
    }

    let body: unknown;

    try {
      body =
        await request.json();
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

    /*
     * NAME
     */
    if (
      typeof payload.name !==
        "string" ||
      !payload.name.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Option name is required",
        },
        {
          status: 400,
        },
      );
    }

    const name =
      payload.name.trim();

    if (name.length < 1) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Option name is required",
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
            "Option name must not exceed 100 characters",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * VARIATION GROUP
     */
    if (
      typeof payload.variationGroupId !==
        "string" ||
      !payload.variationGroupId.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "variationGroupId is required",
        },
        {
          status: 400,
        },
      );
    }

    const variationGroupId =
      payload.variationGroupId.trim();

    /*
     * DESCRIPTION
     */
    let description:
      | string
      | null = null;

    if (
      payload.description !==
        undefined &&
      payload.description !==
        null
    ) {
      if (
        typeof payload.description !==
        "string"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Description must be a string",
          },
          {
            status: 400,
          },
        );
      }

      description =
        payload.description.trim();

      if (
        description.length > 500
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Description must not exceed 500 characters",
          },
          {
            status: 400,
          },
        );
      }
    }

    /*
     * PRICE
     *
     * 0 is a valid price.
     */
    let price = 0;

    if (
      payload.price !== undefined
    ) {
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
              "Option price must be a non-negative number",
          },
          {
            status: 400,
          },
        );
      }

      price =
        payload.price;
    }

    /*
     * SORT ORDER
     */
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

    /*
     * DEFAULT STATUS
     */
    let isDefault = false;

    if (
      payload.isDefault !==
      undefined
    ) {
      if (
        typeof payload.isDefault !==
        "boolean"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "isDefault must be a boolean",
          },
          {
            status: 400,
          },
        );
      }

      isDefault =
        payload.isDefault;
    }

    /*
     * ACTIVE STATUS
     */
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

    /*
     * Verify that the variation group
     * belongs to the authenticated
     * restaurant.
     */
    const variationGroup =
      await prisma.variationGroup.findFirst({
        where: {
          id: variationGroupId,

          restaurantId:
            user.restaurantId,
        },

        select: {
          id: true,
        },
      });

    if (!variationGroup) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Variation group not found",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Create option.
     */
    const option =
      await prisma.variationOption.create({
        data: {
          name,

          description,

          price,

          sortOrder,

          isDefault,

          isActive,

          variationGroupId,
        },

        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          sortOrder: true,
          isDefault: true,
          isActive: true,
        },
      });

    return NextResponse.json(
      {
        success: true,

        data:
          serializeOption(
            option,
          ),
      },
      {
        status: 201,
      },
    );
  } catch (error: unknown) {
    if (
      isPrismaUniqueError(error)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Variation option already exists",
        },
        {
          status: 409,
        },
      );
    }

    console.error(
      "POST /api/variation-options error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to create variation option",
      },
      {
        status: 500,
      },
    );
  }
}