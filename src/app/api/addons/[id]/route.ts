import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/api-auth";

import {
  hasPermission,
  PERMISSIONS,
  Roles,
} from "@/lib/rbac";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

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
      message: "Addon not found",
    },
    {
      status: 404,
    },
  );
}

function badRequest(
  message: string,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status: 400,
    },
  );
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

async function findOwnedAddon(
  id: string,
  restaurantId: string,
) {
  return prisma.addon.findFirst({
    where: {
      id,
      restaurantId,
      deletedAt: null,
    },

    select: {
      id: true,
      name: true,
      price: true,
      isActive: true,
      sortOrder: true,
      restaurantId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * PATCH /api/addons/[id]
 */
export async function PATCH(
  request: Request,
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
        PERMISSIONS.ADDON_UPDATE,
      )
    ) {
      return forbidden();
    }

    const { id } =
      await context.params;

    if (!id?.trim()) {
      return notFound();
    }

    const existing =
      await findOwnedAddon(
        id,
        user.restaurantId,
      );

    if (!existing) {
      return notFound();
    }

    let body: unknown;

    try {
      body =
        await request.json();
    } catch {
      return badRequest(
        "Invalid JSON body",
      );
    }

    if (
      typeof body !== "object" ||
      body === null
    ) {
      return badRequest(
        "Invalid request body",
      );
    }

    const payload =
      body as Record<
        string,
        unknown
      >;

    const data: {
      name?: string;
      price?: number;
      isActive?: boolean;
      sortOrder?: number;
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
        return badRequest(
          "Addon name must be a non-empty string",
        );
      }

      const name =
        payload.name.trim();

      if (name.length < 2) {
        return badRequest(
          "Addon name must contain at least 2 characters",
        );
      }

      if (name.length > 100) {
        return badRequest(
          "Addon name must not exceed 100 characters",
        );
      }

      data.name = name;
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
        return badRequest(
          "Addon price must be a non-negative number",
        );
      }

      data.price =
        payload.price;
    }

    /*
     * ACTIVE STATUS
     */
    if (
      payload.isActive !==
      undefined
    ) {
      if (
        typeof payload.isActive !==
        "boolean"
      ) {
        return badRequest(
          "isActive must be a boolean",
        );
      }

      data.isActive =
        payload.isActive;
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
        return badRequest(
          "sortOrder must be a non-negative integer",
        );
      }

      data.sortOrder =
        payload.sortOrder;
    }

    if (
      Object.keys(data)
        .length === 0
    ) {
      return badRequest(
        "At least one field is required",
      );
    }

    const updated =
      await prisma.addon.update({
        where: {
          id: existing.id,
        },

        data,

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

    return NextResponse.json({
      success: true,
      data:
        serializeAddon(
          updated,
        ),
    });
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
      "PATCH /api/addons/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to update addon",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * DELETE /api/addons/[id]
 */
export async function DELETE(
  _request: Request,
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
        PERMISSIONS.ADDON_DELETE,
      )
    ) {
      return forbidden();
    }

    const { id } =
      await context.params;

    if (!id?.trim()) {
      return notFound();
    }

    const existing =
      await findOwnedAddon(
        id,
        user.restaurantId,
      );

    if (!existing) {
      return notFound();
    }

    /*
     * Menu item usage
     */
    const menuItemUsage =
      await prisma.menuItemAddon.findFirst({
        where: {
          addonId: id,
        },

        select: {
          id: true,
        },
      });

    if (menuItemUsage) {
      return badRequest(
        "Cannot delete: addon is linked to menu items",
      );
    }

    /*
     * Order usage
     */
    const orderUsage =
      await prisma.orderItemAddon.findFirst({
        where: {
          addonId: id,
        },

        select: {
          id: true,
        },
      });

    if (orderUsage) {
      return badRequest(
        "Cannot delete: addon is used in existing orders",
      );
    }

    /*
     * Recipe usage
     */
    const recipeUsage =
      await prisma.addonRecipeItem.findFirst({
        where: {
          addonId: id,
        },

        select: {
          id: true,
        },
      });

    if (recipeUsage) {
      return badRequest(
        "Cannot delete: addon is used in a recipe",
      );
    }

    await prisma.addon.delete({
      where: {
        id: existing.id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    console.error(
      "DELETE /api/addons/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to delete addon",
      },
      {
        status: 500,
      },
    );
  }
}