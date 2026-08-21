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

import { generateSlug } from "@/features/categories/utils/slug";

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
        "Variation not found",
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

function getId(
  params: Promise<{ id: string }>,
): Promise<string> {
  return params.then(
    ({ id }) => id,
  );
}

/**
 * PATCH /api/variations/[id]
 *
 * Updates a variation group.
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

    const id =
      await getId(
        context.params,
      );

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

    const existing =
      await prisma.variationGroup.findFirst({
        where: {
          id,
          restaurantId:
            user.restaurantId,
        },

        select: {
          id: true,
          name: true,
          slug: true,
        },
      });

    if (!existing) {
      return notFound();
    }

    const data: {
      name?: string;
      slug?: string;
      description?: string | null;
      isActive?: boolean;
    } = {};

    if (
      payload.name !== undefined
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
              "Variation name must be a non-empty string",
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
              "Variation name must contain at least 2 characters",
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
              "Variation name must not exceed 100 characters",
          },
          {
            status: 400,
          },
        );
      }

      data.name = name;

      const slug =
        generateSlug(name);

      if (!slug) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Unable to generate variation slug",
          },
          {
            status: 400,
          },
        );
      }

      data.slug = slug;
    }

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
      await prisma.variationGroup.update({
        where: {
          id,
        },

        data,

        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          isActive: true,
          createdAt: true,
        },
      });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    if (
      isPrismaUniqueError(error)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Variation slug already exists",
        },
        {
          status: 409,
        },
      );
    }

    console.error(
      "PATCH /api/variations/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to update variation",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * DELETE /api/variations/[id]
 *
 * Deletes a variation group belonging
 * to the authenticated restaurant.
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

    const id =
      await getId(
        context.params,
      );

    if (!id.trim()) {
      return notFound();
    }

    const existing =
      await prisma.variationGroup.findFirst({
        where: {
          id,
          restaurantId:
            user.restaurantId,
        },

        select: {
          id: true,
        },
      });

    if (!existing) {
      return notFound();
    }

    const linkedMenuItem =
      await prisma.menuItemVariation.findFirst({
        where: {
          variationGroupId: id,
        },

        select: {
          id: true,
        },
      });

    if (linkedMenuItem) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Cannot delete variation linked to menu items",
        },
        {
          status: 400,
        },
      );
    }

    await prisma.variationGroup.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    console.error(
      "DELETE /api/variations/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to delete variation",
      },
      {
        status: 500,
      },
    );
  }
}