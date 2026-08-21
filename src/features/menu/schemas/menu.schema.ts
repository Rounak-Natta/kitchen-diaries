// features/menu/schemas/menu.schema.ts
import { z } from "zod";
import { DietaryType, MenuItemStatus, SpiceLevel } from "@prisma/client";

export const menuSchema = z.object({
  name: z.string().min(2, "Name too short"),
  description: z.string().optional(),
  shortCode: z.string().optional(),
  imageUrl: z.string().optional(),
  price: z.number().min(0),
  comparePrice: z.number().optional(),
  costPrice: z.number().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  preparationTime: z.number().int().min(0).optional(),
  calories: z.number().int().min(0).optional(),
  categoryId: z.string().min(1, "Category required"),
  dietaryType: z.nativeEnum(DietaryType),
  spiceLevel: z.nativeEnum(SpiceLevel),
  status: z.nativeEnum(MenuItemStatus),
  isFeatured: z.boolean(),
  isRecommended: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});

export type MenuSchema = z.infer<typeof menuSchema>;
export type MenuSchemaType = MenuSchema;