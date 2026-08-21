// features/categories/schemas/category.schema.ts
import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(2, "Too short").max(50, "Too long"),
  description: z.string().max(200).optional(),
  type: z.enum(["FOOD", "BEVERAGE", "DESSERT", "STARTER", "MAIN_COURSE", "SNACK", "COMBO"]),
  dietaryType: z.enum(["VEG", "NON_VEG", "EGG", "VEGAN", "JAIN"]),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  slug: z.string().min(2).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;