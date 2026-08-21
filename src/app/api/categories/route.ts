import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/api-auth";
import { hasPermission, PERMISSIONS, Roles } from "@/lib/rbac";
import { createCategorySchema } from "@/features/categories/schemas/category.schema";
import { generateSlug } from "@/features/categories/utils/slug";

// GET - use findMany with lean select (already fine, but ensure index)
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();

    const categories = await prisma.category.findMany({
      where: { restaurantId: user.restaurantId },
      select: { id: true, name: true, slug: true, description: true, type: true, dietaryType: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Failed to fetch" }, { status: 500 });
  }
}

// POST - reduced duplicate checks
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    if (!hasPermission(user.role as Roles, PERMISSIONS.CATEGORY_MANAGE)) return forbidden();

    const body = await request.json();
    const validated = createCategorySchema.parse(body);
    const slug = generateSlug(validated.name);

    // Single DB call - rely on unique constraint
    const category = await prisma.category.create({
      data: {
        name: validated.name,
        slug,
        description: validated.description,
        type: validated.type,
        dietaryType: validated.dietaryType,
        isActive: validated.isActive ?? true,
        restaurantId: user.restaurantId,
      },
      select: { id: true, name: true, slug: true, description: true, type: true, dietaryType: true, isActive: true, createdAt: true },
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ success: false, message: "Category already exists" }, { status: 409 });
    }
    console.error("POST error:", error);
    return NextResponse.json({ success: false, message: "Internal error" }, { status: 500 });
  }
}

function unauthorized() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
}