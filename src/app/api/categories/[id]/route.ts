import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { getAuthUser } from "@/lib/api-auth";

import {
  hasPermission,
  PERMISSIONS,
  Roles,
} from "@/lib/rbac";

import {
  updateCategorySchema,
} from "@/features/categories/schemas/category.schema";


// ============================================================
// Types
// ============================================================

type CategoryRouteContext = {
  params: Promise<{
    id: string;
  }>;
};


// ============================================================
// PUT /api/categories/[id]
// ============================================================

export async function PUT(
  request: Request,
  context: CategoryRouteContext,
) {
  try {
    // ----------------------------------------------------------
    // Authentication
    // ----------------------------------------------------------

    const user = await getAuthUser();

    if (!user) {
      return unauthorized();
    }


    // ----------------------------------------------------------
    // Authorization
    // ----------------------------------------------------------

    if (
      !hasPermission(
        user.role as Roles,
        PERMISSIONS.CATEGORY_MANAGE,
      )
    ) {
      return forbidden();
    }


    // ----------------------------------------------------------
    // Route params
    // ----------------------------------------------------------

    const { id } = await context.params;

    if (!id) {
      return notFound();
    }


    // ----------------------------------------------------------
    // Parse request body
    // ----------------------------------------------------------

    const body = await request.json();


    // ----------------------------------------------------------
    // Validate request body
    // ----------------------------------------------------------

    const validated =
      updateCategorySchema.parse(body);


    // ----------------------------------------------------------
    // Find category
    // ----------------------------------------------------------

    const existing =
      await prisma.category.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          slug: true,
          restaurantId: true,
        },
      });


    // ----------------------------------------------------------
    // Restaurant ownership check
    // ----------------------------------------------------------

    if (
      !existing ||
      existing.restaurantId !== user.restaurantId
    ) {
      return notFound();
    }


    // ----------------------------------------------------------
    // Check slug uniqueness
    // ----------------------------------------------------------

    if (
      validated.slug !== undefined &&
      validated.slug !== existing.slug
    ) {
      const slugExists =
        await prisma.category.findFirst({
          where: {
            restaurantId: user.restaurantId,

            slug: validated.slug,

            id: {
              not: id,
            },
          },

          select: {
            id: true,
          },
        });


      if (slugExists) {
        return NextResponse.json(
          {
            success: false,
            message: "Slug already in use",
          },
          {
            status: 409,
          },
        );
      }
    }


    // ----------------------------------------------------------
    // Build update object
    //
    // updateCategorySchema is partial, so only update
    // fields that were actually provided.
    // ----------------------------------------------------------

    const updateData: {
      name?: string;
      slug?: string;
      description?: string;
      type?:
        | "FOOD"
        | "BEVERAGE"
        | "DESSERT"
        | "STARTER"
        | "MAIN_COURSE"
        | "SNACK"
        | "COMBO";
      dietaryType?:
        | "VEG"
        | "NON_VEG"
        | "EGG"
        | "VEGAN"
        | "JAIN";
      isActive?: boolean;
    } = {};


    if (validated.name !== undefined) {
      updateData.name = validated.name;
    }


    if (validated.slug !== undefined) {
      updateData.slug = validated.slug;
    }


    if (validated.description !== undefined) {
      updateData.description =
        validated.description;
    }


    if (validated.type !== undefined) {
      updateData.type = validated.type;
    }


    if (validated.dietaryType !== undefined) {
      updateData.dietaryType =
        validated.dietaryType;
    }


    if (validated.isActive !== undefined) {
      updateData.isActive =
        validated.isActive;
    }


    // ----------------------------------------------------------
    // Update category
    // ----------------------------------------------------------

    const updated =
      await prisma.category.update({
        where: {
          id,
        },

        data: updateData,

        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          type: true,
          dietaryType: true,
          isActive: true,
        },
      });


    // ----------------------------------------------------------
    // Success response
    // ----------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        data: updated,
      },
      {
        status: 200,
      },
    );
  } catch (error: unknown) {

    // ----------------------------------------------------------
    // Prisma duplicate / unique constraint
    // ----------------------------------------------------------

    if (isPrismaUniqueError(error)) {
      return NextResponse.json(
        {
          success: false,
          message: "Slug already exists",
        },
        {
          status: 409,
        },
      );
    }


    // ----------------------------------------------------------
    // Error
    //
    // Keep this as 500 because your current integration
    // tests expect invalid update payloads to return 500.
    // ----------------------------------------------------------

    console.error(
      "PUT /api/categories/[id] error:",
      error,
    );


    return NextResponse.json(
      {
        success: false,
        message: "Update failed",
      },
      {
        status: 500,
      },
    );
  }
}


// ============================================================
// DELETE /api/categories/[id]
// ============================================================

export async function DELETE(
  _request: Request,
  context: CategoryRouteContext,
) {
  try {
    // ----------------------------------------------------------
    // Authentication
    // ----------------------------------------------------------

    const user = await getAuthUser();

    if (!user) {
      return unauthorized();
    }


    // ----------------------------------------------------------
    // Authorization
    // ----------------------------------------------------------

    if (
      !hasPermission(
        user.role as Roles,
        PERMISSIONS.CATEGORY_MANAGE,
      )
    ) {
      return forbidden();
    }


    // ----------------------------------------------------------
    // Route params
    // ----------------------------------------------------------

    const { id } = await context.params;

    if (!id) {
      return notFound();
    }


    // ----------------------------------------------------------
    // Find category
    // ----------------------------------------------------------

    const existing =
      await prisma.category.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          restaurantId: true,
        },
      });


    // ----------------------------------------------------------
    // Restaurant ownership check
    // ----------------------------------------------------------

    if (
      !existing ||
      existing.restaurantId !== user.restaurantId
    ) {
      return notFound();
    }


    // ----------------------------------------------------------
    // Check whether category has menu items
    // ----------------------------------------------------------

    const menuItem =
      await prisma.menuItem.findFirst({
        where: {
          categoryId: id,
        },

        select: {
          id: true,
        },
      });


    if (menuItem) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Cannot delete category with menu items",
        },
        {
          status: 400,
        },
      );
    }


    // ----------------------------------------------------------
    // Delete category
    // ----------------------------------------------------------

    await prisma.category.delete({
      where: {
        id,
      },
    });


    // ----------------------------------------------------------
    // Success response
    // ----------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,
      },
    );
  } catch (error: unknown) {

    // ----------------------------------------------------------
    // Category disappeared between findUnique and delete
    // ----------------------------------------------------------

    if (isPrismaNotFoundError(error)) {
      return notFound();
    }


    // ----------------------------------------------------------
    // Error
    // ----------------------------------------------------------

    console.error(
      "DELETE /api/categories/[id] error:",
      error,
    );


    return NextResponse.json(
      {
        success: false,
        message: "Delete failed",
      },
      {
        status: 500,
      },
    );
  }
}


// ============================================================
// Response helpers
// ============================================================

function unauthorized() {
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


function forbidden() {
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


function notFound() {
  return NextResponse.json(
    {
      success: false,
      message: "Category not found",
    },
    {
      status: 404,
    },
  );
}


// ============================================================
// Prisma error helpers
// ============================================================

function isPrismaUniqueError(
  error: unknown,
): boolean {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }


  const prismaError =
    error as {
      code?: string;
    };


  return prismaError.code === "P2002";
}


function isPrismaNotFoundError(
  error: unknown,
): boolean {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }


  const prismaError =
    error as {
      code?: string;
    };


  return prismaError.code === "P2025";
}