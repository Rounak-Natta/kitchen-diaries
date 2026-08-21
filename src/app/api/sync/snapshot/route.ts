import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const money = (value: unknown) => value == null ? null : Number(value);

export async function GET(request: Request): Promise<Response> {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const [restaurant, categories, menuItems, variations, addons, inventoryCategories, inventoryItems, recipes] =
    await Promise.all([
      prisma.restaurant.findUnique({
        where: { id: user.restaurantId },
        select: { id: true, name: true, currency: true, timezone: true, defaultTaxRate: true, orderPrefix: true, billPrefix: true, receiptPrefix: true, updatedAt: true },
      }),
      prisma.category.findMany({ where: { restaurantId: user.restaurantId, isActive: true, deletedAt: null }, select: { id: true, name: true, slug: true, type: true, dietaryType: true, isActive: true, restaurantId: true, createdAt: true, updatedAt: true } }),
      prisma.menuItem.findMany({
        where: { restaurantId: user.restaurantId, isActive: true, deletedAt: null },
        include: {
          variations: { include: { variationGroup: { include: { options: { where: { isActive: true } } } } } },
          addons: { where: { addon: { isActive: true } }, include: { addon: true } },
        },
      }),
      prisma.variationGroup.findMany({ where: { restaurantId: user.restaurantId, isActive: true, deletedAt: null }, include: { options: { where: { isActive: true } } } }),
      prisma.addon.findMany({ where: { restaurantId: user.restaurantId, isActive: true, deletedAt: null } }),
      prisma.inventoryCategory.findMany({ where: { restaurantId: user.restaurantId, isActive: true, deletedAt: null } }),
      prisma.inventoryItem.findMany({ where: { restaurantId: user.restaurantId, isActive: true, deletedAt: null } }),
      prisma.recipe.findMany({ where: { restaurantId: user.restaurantId, isActive: true, deletedAt: null }, include: { items: true } }),
    ]);

  const common = <T extends { id: string; restaurantId?: string; createdAt?: Date; updatedAt: Date }>(item: T) => ({
    ...item,
    restaurantId: item.restaurantId ?? user.restaurantId,
    version: 1,
    createdAt: (item.createdAt ?? item.updatedAt).toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  });

  return NextResponse.json({
    success: true,
    data: {
      restaurant: restaurant ? { ...common(restaurant), defaultTaxRate: money(restaurant.defaultTaxRate) } : null,
      categories: categories.map(common),
      menuItems: menuItems.map((item) => common({ ...item, price: money(item.price), comparePrice: money(item.comparePrice), costPrice: money(item.costPrice), taxRate: money(item.taxRate), variations: item.variations.map((v) => ({ ...v, variationGroup: { ...v.variationGroup, options: v.variationGroup.options.map((o) => ({ ...o, price: money(o.price) })) } })), addons: item.addons.map((a) => ({ ...a, addon: { ...a.addon, price: money(a.addon.price) } })) })),
      variations: variations.map((item) => common(item)),
      variationOptions: variations.flatMap((group) => group.options.map((option) => common({ ...option, restaurantId: group.restaurantId }))),
      addons: addons.map((item) => common({ ...item, price: money(item.price) })),
      inventoryCategories: inventoryCategories.map(common),
      inventoryItems: inventoryItems.map((item) => common({ ...item, averageCost: money(item.averageCost), currentStock: money(item.currentStock), minimumStock: money(item.minimumStock), reorderLevel: money(item.reorderLevel) })),
      recipes: recipes.map(common),
      recipeItems: recipes.flatMap((recipe) => recipe.items.map((item) => common({ ...item, restaurantId: recipe.restaurantId, recipeId: recipe.id, quantity: money(item.quantity), wastagePercent: money(item.wastagePercent) }))),
    },
  });
}
