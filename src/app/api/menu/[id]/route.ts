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
      message: "Menu item not found",
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

async function getOwnedMenuItem(
  id: string,
  restaurantId: string,
) {
  return prisma.menuItem.findFirst({
    where: {
      id,

      restaurantId,

      deletedAt: null,
    },

    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
}

/**
 * GET /api/menu/[id]
 */
export async function GET(
  _request: Request,
  { params }: RouteContext,
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
        PERMISSIONS.MENU_VIEW,
      )
    ) {
      return forbidden();
    }

    const { id } =
      await params;

    const menu =
      await prisma.menuItem.findFirst({
        where: {
          id,

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
          categoryId: true,
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

          variations: {
            select: {
              variationGroupId:
                true,
            },
          },

          addons: {
            select: {
              addonId: true,
            },
          },

          createdAt: true,
          updatedAt: true,
        },
      });

    if (!menu) {
      return notFound();
    }

    return NextResponse.json({
      success: true,

      data:
        serializeMenuItem(
          menu,
        ),
    });
  } catch (error: unknown) {
    console.error(
      "GET /api/menu/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to fetch menu item",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * PATCH /api/menu/[id]
 */
export async function PATCH(
  request: Request,
  { params }: RouteContext,
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
      await params;

    const existing =
      await getOwnedMenuItem(
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

    const hasVariationIds =
      Object.prototype.hasOwnProperty.call(
        payload,
        "variationIds",
      );

    const hasAddonIds =
      Object.prototype.hasOwnProperty.call(
        payload,
        "addonIds",
      );

    const variationIds =
      payload.variationIds;

    const addonIds =
      payload.addonIds;

    if (
      hasVariationIds &&
      !isStringArray(
        variationIds,
      )
    ) {
      return badRequest(
        "variationIds must be an array of strings",
      );
    }

    if (
      hasAddonIds &&
      !isStringArray(addonIds)
    ) {
      return badRequest(
        "addonIds must be an array of strings",
      );
    }

    const {
      variationIds:
        _variationIds,
      addonIds:
        _addonIds,
      ...menuPayload
    } = payload;

    const validated =
      menuSchema
        .partial()
        .parse(
          menuPayload,
        );

    /*
     * Category ownership.
     */
    if (
      validated.categoryId
    ) {
      const category =
        await prisma.category.findFirst({
          where: {
            id:
              validated.categoryId,

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
    }

    /*
     * Variation ownership.
     */
    if (
      hasVariationIds
    ) {
      const requestedVariationIds =
        variationIds as string[];

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
    }

    /*
     * Addon ownership.
     */
    if (
      hasAddonIds
    ) {
      const requestedAddonIds =
        addonIds as string[];

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
    }

    const slug =
      validated.name
        ? generateSlug(
            validated.name,
          )
        : undefined;

    const updated =
      await prisma.$transaction(
        async (transaction) => {
          const menu =
            await transaction.menuItem.update({
              where: {
                id,
              },

              data: {
                ...validated,

                ...(slug
                  ? {
                      slug,
                    }
                  : {}),

                ...(hasVariationIds
                  ? {
                      variations: {
                        deleteMany: {},

                        create:
                          (
                            variationIds as string[]
                          ).map(
                            (
                              variationGroupId,
                            ) => ({
                              variationGroupId,
                            }),
                          ),
                      },
                    }
                  : {}),

                ...(hasAddonIds
                  ? {
                      addons: {
                        deleteMany: {},

                        create:
                          (
                            addonIds as string[]
                          ).map(
                            (addonId) => ({
                              addonId,
                            }),
                          ),
                      },
                    }
                  : {}),
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

          return menu;
        },
      );

    return NextResponse.json({
      success: true,

      data:
        serializeMenuItem(
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
            "Menu item with this slug already exists",
        },
        {
          status: 409,
        },
      );
    }

    console.error(
      "PATCH /api/menu/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to update menu item",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * DELETE /api/menu/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: RouteContext,
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
      await params;

    const existing =
      await prisma.menuItem.findFirst({
        where: {
          id,

          restaurantId:
            user.restaurantId,

          deletedAt: null,
        },

        select: {
          id: true,
        },
      });

    if (!existing) {
      return notFound();
    }

    /*
     * We soft-delete menu items instead
     * of physically deleting them.
     *
     * This protects order history and
     * historical references.
     */
    await prisma.menuItem.update({
      where: {
        id,
      },

      data: {
        deletedAt:
          new Date(),

        isActive:
          false,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    console.error(
      "DELETE /api/menu/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to delete menu item",
      },
      {
        status: 500,
      },
    );
  }
}