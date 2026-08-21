import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/api-auth";

import {
  hasPermission,
  PERMISSIONS,
  Roles,
} from "@/lib/rbac";

import { menuSchema } from "@/features/menu/schemas/menu.schema";
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

function serializeMenuItem<
  T extends {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    shortCode: string | null;
    imageUrl: string | null;
    price: unknown;
    comparePrice: unknown;
    costPrice: unknown;
    sku: string | null;
    barcode: string | null;
    preparationTime: number | null;
    calories: number | null;
    dietaryType: unknown;
    spiceLevel: unknown;
    status: unknown;
    isFeatured: boolean;
    isRecommended: boolean;
    isActive: boolean;
    sortOrder: number;
  },
>(item: T) {
  return {
    ...item,

    price: Number(item.price),

    comparePrice:
      item.comparePrice !== null &&
      item.comparePrice !== undefined
        ? Number(item.comparePrice)
        : null,

    costPrice:
      item.costPrice !== null &&
      item.costPrice !== undefined
        ? Number(item.costPrice)
        : null,
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

function isStringArray(
  value: unknown,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0,
    )
  );
}

/**
 * GET /api/menu
 *
 * Returns menu items belonging only to
 * the authenticated restaurant.
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

    const menuItems =
      await prisma.menuItem.findMany({
        where: {
          restaurantId:
            user.restaurantId,

          deletedAt: null,
        },

        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          shortCode: true,
          imageUrl: true,
          price: true,
          comparePrice: true,
          costPrice: true,
          sku: true,
          barcode: true,
          preparationTime: true,
          calories: true,
          dietaryType: true,
          spiceLevel: true,
          status: true,
          isFeatured: true,
          isRecommended: true,
          isActive: true,
          sortOrder: true,

          category: {
            select: {
              id: true,
              name: true,
            },
          },

          createdAt: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return NextResponse.json({
      success: true,

      data: menuItems.map(
        serializeMenuItem,
      ),
    });
  } catch (error: unknown) {
    console.error(
      "GET /api/menu error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to fetch menu items",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * POST /api/menu
 *
 * Creates a menu item.
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

    const variationIds =
      payload.variationIds;

    const addonIds =
      payload.addonIds;

    if (
      variationIds !== undefined &&
      !isStringArray(
        variationIds,
      )
    ) {
      return badRequest(
        "variationIds must be an array of strings",
      );
    }

    if (
      addonIds !== undefined &&
      !isStringArray(addonIds)
    ) {
      return badRequest(
        "addonIds must be an array of strings",
      );
    }

    const {
      variationIds: _variationIds,
      addonIds: _addonIds,
      ...menuPayload
    } = payload;

    const validated =
      menuSchema.parse(
        menuPayload,
      );

    const slug =
      generateSlug(
        validated.name,
      );

    /*
     * Verify category belongs to
     * this restaurant.
     */
    const category =
      await prisma.category.findFirst({
        where: {
          id: validated.categoryId,

          restaurantId:
            user.restaurantId,
        },

        select: {
          id: true,
        },
      });

    if (!category) {
      return badRequest(
        "Category does not belong to this restaurant.",
      );
    }

    /*
     * Verify variation groups belong
     * to this restaurant.
     */
    const requestedVariationIds =
      variationIds ?? [];

    if (
      requestedVariationIds.length >
      0
    ) {
      const variationCount =
        await prisma.variationGroup.count({
          where: {
            id: {
              in:
                requestedVariationIds,
            },

            restaurantId:
              user.restaurantId,
          },
        });

      if (
        variationCount !==
        requestedVariationIds.length
      ) {
        return badRequest(
          "One or more variation groups do not belong to this restaurant.",
        );
      }
    }

    /*
     * Verify addons belong to
     * this restaurant.
     */
    const requestedAddonIds =
      addonIds ?? [];

    if (
      requestedAddonIds.length >
      0
    ) {
      const addonCount =
        await prisma.addon.count({
          where: {
            id: {
              in:
                requestedAddonIds,
            },

            restaurantId:
              user.restaurantId,

            deletedAt: null,
          },
        });

      if (
        addonCount !==
        requestedAddonIds.length
      ) {
        return badRequest(
          "One or more addons do not belong to this restaurant.",
        );
      }
    }

    const menu =
      await prisma.menuItem.create({
        data: {
          ...validated,

          slug,

          restaurantId:
            user.restaurantId,

          variations: {
            create:
              requestedVariationIds.map(
                (
                  variationGroupId,
                ) => ({
                  variationGroupId,
                }),
              ),
          },

          addons: {
            create:
              requestedAddonIds.map(
                (addonId) => ({
                  addonId,
                }),
              ),
          },
        },

        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          shortCode: true,
          imageUrl: true,
          price: true,
          comparePrice: true,
          costPrice: true,
          sku: true,
          barcode: true,
          preparationTime: true,
          calories: true,
          dietaryType: true,
          spiceLevel: true,
          status: true,
          isFeatured: true,
          isRecommended: true,
          isActive: true,
          sortOrder: true,

          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    return NextResponse.json(
      {
        success: true,

        data:
          serializeMenuItem(
            menu,
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
            "Menu item with this slug already exists",
        },
        {
          status: 409,
        },
      );
    }

    console.error(
      "POST /api/menu error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to create menu item",
      },
      {
        status: 500,
      },
    );
  }
}