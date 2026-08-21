import { z } from "zod";

const optionalText = (
  maximumLength: number,
) =>
  z
    .string()
    .trim()
    .max(maximumLength)
    .optional();

export const recipeIngredientSchema =
  z
    .object({
      inventoryItemId: z
        .string()
        .trim()
        .min(
          1,
          "Inventory item is required.",
        ),

      quantity: z
        .number()
        .finite()
        .positive(
          "Ingredient quantity must be greater than zero.",
        )
        .max(999_999_999),

      wastagePercent: z
        .number()
        .finite()
        .min(0)
        .max(
          100,
          "Wastage percentage cannot exceed 100.",
        ),

      notes:
        optionalText(500),
    })
    .strict();

export const saveRecipeSchema =
  z
    .object({
      menuItemId: z
        .string()
        .trim()
        .min(
          1,
          "Menu item is required.",
        ),

      name: z
        .string()
        .trim()
        .min(
          1,
          "Recipe name is required.",
        )
        .max(150),

      description:
        optionalText(1_000),

      notes:
        optionalText(1_000),

      isActive:
        z.boolean(),

      items: z
        .array(
          recipeIngredientSchema,
        )
        .min(
          1,
          "At least one ingredient is required.",
        )
        .max(100),
    })
    .strict()
    .superRefine(
      (data, context) => {
        const seen =
          new Set<string>();

        data.items.forEach(
          (item, index) => {
            if (
              seen.has(
                item.inventoryItemId,
              )
            ) {
              context.addIssue({
                code:
                  z.ZodIssueCode.custom,

                path: [
                  "items",
                  index,
                  "inventoryItemId",
                ],

                message:
                  "The same inventory item cannot be added twice.",
              });
            }

            seen.add(
              item.inventoryItemId,
            );
          },
        );
      },
    );

export type SaveRecipeInput =
  z.infer<
    typeof saveRecipeSchema
  >;