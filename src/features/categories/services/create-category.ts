import {
  CategoryType,
  DietaryType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

type CreateCategoryProps = {
  name: string;

  slug: string;

  description?: string;

  type: CategoryType;

  dietaryType: DietaryType;

  restaurantId: string;
};

export async function createCategory({
  name,
  slug,
  description,
  type,
  dietaryType,
  restaurantId,
}: CreateCategoryProps) {
  // CHECK EXISTING CATEGORY

  const existingCategory =
    await prisma.category.findFirst({
      where: {
        restaurantId,

        OR: [
          {
            name: {
              equals: name,

              mode:
                "insensitive",
            },
          },

          {
            slug,
          },
        ],
      },
    });

  // DUPLICATE CATEGORY

  if (existingCategory) {
    throw new Error(
      "Category already exists"
    );
  }

  // CREATE CATEGORY

  const category =
    await prisma.category.create({
      data: {
        name,

        slug,

        description,

        type,

        dietaryType,

        restaurantId,
      },
    });

  return category;
}