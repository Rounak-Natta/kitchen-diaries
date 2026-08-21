import { prisma } from "@/lib/prisma";

import { MenuSchemaType } from "../schemas/menu.schema";

function generateSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function getMenus(
  restaurantId: string
) {
  return prisma.menuItem.findMany({
    where: {
      restaurantId,
    },

    include: {
      category: true,
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getMenuById(
  id: string
) {
  return prisma.menuItem.findUnique({
    where: {
      id,
    },

    include: {
      category: true,
    },
  });
}

export async function createMenu(
  data: MenuSchemaType,
  restaurantId: string
) {
  return prisma.menuItem.create({
    data: {
      ...data,

      restaurantId,

      slug: generateSlug(data.name),
    },
  });
}

export async function updateMenu(
  id: string,
  data: Partial<MenuSchemaType>
) {
  return prisma.menuItem.update({
    where: {
      id,
    },

    data: {
      ...data,

      ...(data.name
        ? {
            slug: generateSlug(data.name),
          }
        : {}),
    },
  });
}

export async function deleteMenu(
  id: string
) {
  return prisma.menuItem.delete({
    where: {
      id,
    },
  });
}