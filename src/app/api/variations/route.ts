import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/api-auth";

import {
  hasPermission,
  PERMISSIONS,
  Roles,
} from "@/lib/rbac";

import { generateSlug } from "@/features/categories/utils/slug";

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

function serializeVariationGroup(
  variation: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    options: Array<{
      id: string;
      name: string;
      description: string | null;
      price: unknown;
      sortOrder: number;
      isDefault: boolean;
      isActive: boolean;
    }>;
    _count: {
      options: number;
    };
  },
) {
  return {
    id: variation.id,
    name: variation.name,
    slug: variation.slug,
    description: variation.description,
    isActive: variation.isActive,
    createdAt: variation.createdAt,

    options: variation.options.map(
      (option) => ({
        id: option.id,
        name: option.name,
        description: option.description,
        price: Number(option.price),
        sortOrder: option.sortOrder,
        isDefault: option.isDefault,
        isActive: option.isActive,
      }),
    ),

    _count: {
      options:
        variation._count.options,
    },
  };
}

/**
 * GET /api/variations
 *
 * Returns all variation groups belonging
 * to the authenticated restaurant.
 */
export async function GET(): Promise<Response> {
  try {
    const user =
      await getAuthUser();

    if (!user) {
      return unauthorized();
    }

    if (
      !hasPermission(
        user.role as Roles,
        PERMISSIONS.MENU_VIEW,
      )
    ) {
      return forbidden();
    }

    const variations =
      await prisma.variationGroup.findMany({
        where: {
          restaurantId:
            user.restaurantId,
        },

        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          isActive: true,
          createdAt: true,

          options: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              sortOrder: true,
              isDefault: true,
              isActive: true,
            },

            orderBy: {
              sortOrder: "asc",
            },
          },

          _count: {
            select: {
              options: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return NextResponse.json({
      success: true,

      data: variations.map(
        serializeVariationGroup,
      ),
    });
  } catch (error: unknown) {
    console.error(
      "GET /api/variations error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to fetch variations",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * POST /api/variations
 *
 * Creates a variation group.
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

    if (
      typeof payload.name !==
        "string" ||
      !payload.name.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Variation name is required",
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

    let description:
      | string
      | undefined;

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
              "Description must be a string",
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
    }

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

    const variation =
      await prisma.variationGroup.create({
        data: {
          name,
          slug,
          description:
            description || null,
          isActive: true,
          restaurantId:
            user.restaurantId,
        },

        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          isActive: true,
          createdAt: true,
        },
      });

    return NextResponse.json(
      {
        success: true,
        data: variation,
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
            "Variation slug already exists",
        },
        {
          status: 409,
        },
      );
    }

    console.error(
      "POST /api/variations error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to create variation",
      },
      {
        status: 500,
      },
    );
  }
}