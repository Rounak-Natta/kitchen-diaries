import { prisma } from "@/lib/prisma";

import type {
  RestaurantUserEditorDto,
  RestaurantUserListItemDto,
} from "../types";

export async function getRestaurantUsers(
  restaurantId: string,
): Promise<
  RestaurantUserListItemDto[]
> {
  const users =
    await prisma.user.findMany({
      where: {
        restaurantId,
      },

      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },

      orderBy: [
        {
          isActive: "desc",
        },
        {
          name: "asc",
        },
      ],
    });

  return users.map(
    (user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive:
        user.isActive,

      lastLoginAt:
        user.lastLoginAt
          ?.toISOString() ??
        null,

      createdAt:
        user.createdAt.toISOString(),

      updatedAt:
        user.updatedAt.toISOString(),
    }),
  );
}

export async function getRestaurantUserForEdit(
  restaurantId: string,
  userId: string,
): Promise<
  RestaurantUserEditorDto | null
> {
  const user =
    await prisma.user.findFirst({
      where: {
        id: userId,
        restaurantId,
      },

      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
      },
    });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive:
      user.isActive,

    lastLoginAt:
      user.lastLoginAt
        ?.toISOString() ??
      null,
  };
}