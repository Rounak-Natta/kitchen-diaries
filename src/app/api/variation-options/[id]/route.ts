import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/api-auth";

import {
  hasPermission,
  PERMISSIONS,
  Roles,
} from "@/lib/rbac";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

function notFound(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message:
        "Option not found",
    },
    {
      status: 404,
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
 * PATCH /api/variation-options/[id]
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
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
        PERMISSIONS.MENU_UPDATE,
      )
    ) {
      return forbidden();
    }

    const { id } =
      await context.params;

    if (!id.trim()) {
      return notFound();
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
     * Make sure the option belongs
     * to this restaurant.
     */
    const existing =
      await prisma.variationOption.findFirst({
        where: {
          id,

          variationGroup: {
            restaurantId:
              user.restaurantId,
          },
        },

        select: {
          id: true,
        },
      });

    if (!existing) {
      return notFound();
    }

    const data: {
      name?: string;
      description?: string | null;
      price?: number;
      sortOrder?: number;
      isDefault?: boolean;
      isActive?: boolean;
    } = {};

    /*
     * NAME
     */
    if (
      payload.name !==
      undefined
    ) {
      if (
        typeof payload.name !==
          "string" ||
        !payload.name.trim()
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Option name must be a non-empty string",
          },
          {
            status: 400,
          },
        );
      }

      const name =
        payload.name.trim();

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

      data.name = name;
    }

    /*
     * DESCRIPTION
     */
    if (
      payload.description !==
      undefined
    ) {
      if (
        payload.description !==
          null &&
        typeof payload.description !==
          "string"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Description must be a string or null",
          },
          {
            status: 400,
          },
        );
      }

      if (
        typeof payload.description ===
        "string"
      ) {
        const description =
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

        data.description =
          description || null;
      } else {
        data.description =
          null;
      }
    }

    /*
     * PRICE
     */
    if (
      payload.price !==
      undefined
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

      data.price =
        payload.price;
    }

    /*
     * SORT ORDER
     */
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

      data.sortOrder =
        payload.sortOrder;
    }

    /*
     * DEFAULT
     */
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

      data.isDefault =
        payload.isDefault;
    }

    /*
     * ACTIVE
     */
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

      data.isActive =
        payload.isActive;
    }

    if (
      Object.keys(data).length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No fields provided for update",
        },
        {
          status: 400,
        },
      );
    }

    const updated =
      await prisma.variationOption.update({
        where: {
          id,
        },

        data,

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

    return NextResponse.json({
      success: true,

      data:
        serializeOption(
          updated,
        ),
    });
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
      "PATCH /api/variation-options/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to update variation option",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * DELETE /api/variation-options/[id]
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
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
        PERMISSIONS.MENU_DELETE,
      )
    ) {
      return forbidden();
    }

    const { id } =
      await context.params;

    if (!id.trim()) {
      return notFound();
    }

    const existing =
      await prisma.variationOption.findFirst({
        where: {
          id,

          variationGroup: {
            restaurantId:
              user.restaurantId,
          },
        },

        select: {
          id: true,
        },
      });

    if (!existing) {
      return notFound();
    }

    await prisma.variationOption.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    console.error(
      "DELETE /api/variation-options/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to delete variation option",
      },
      {
        status: 500,
      },
    );
  }
}