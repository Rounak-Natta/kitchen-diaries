import { z } from "zod";

const inventoryItemTypeSchema =
  z.enum([
    "RAW_MATERIAL",
    "FINISHED_PRODUCT",
    "PACKAGING",
    "CONSUMABLE",
  ]);

const inventoryUnitSchema =
  z.enum([
    "GRAM",
    "KILOGRAM",
    "MILLILITRE",
    "LITRE",
    "PIECE",
    "PACKET",
    "BOX",
    "BOTTLE",
    "CAN",
    "PORTION",
  ]);

const optionalText = (
  maximumLength: number,
) =>
  z
    .string()
    .trim()
    .max(maximumLength)
    .optional();

const inventoryItemBaseSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(
        1,
        "Inventory item name is required.",
      )
      .max(150),

    code: z
      .string()
      .trim()
      .min(
        1,
        "Inventory item code is required.",
      )
      .max(80),

    barcode:
      optionalText(100),

    description:
      optionalText(1_000),

    type:
      inventoryItemTypeSchema,

    unit:
      inventoryUnitSchema,

    categoryId: z
      .string()
      .trim()
      .min(1)
      .optional(),

    minimumStock: z
      .number()
      .finite()
      .min(0)
      .max(999_999_999),

    reorderLevel: z
      .number()
      .finite()
      .min(0)
      .max(999_999_999),

    allowNegativeStock:
      z.boolean(),

    notes:
      optionalText(1_000),
  });

export const createInventoryItemSchema =
  inventoryItemBaseSchema
    .extend({
      idempotencyKey:
        z.string().uuid(),

      openingStock: z
        .number()
        .finite()
        .min(0)
        .max(999_999_999),

      openingUnitCost: z
        .number()
        .finite()
        .min(0)
        .max(999_999_999)
        .optional(),
    })
    .strict()
    .superRefine(
      (data, context) => {
        if (
          data.openingStock > 0 &&
          data.openingUnitCost ===
            undefined
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              "openingUnitCost",
            ],

            message:
              "Opening unit cost is required when opening stock is greater than zero.",
          });
        }
      },
    );

export const updateInventoryItemSchema =
  inventoryItemBaseSchema.strict();

export type CreateInventoryItemInput =
  z.infer<
    typeof createInventoryItemSchema
  >;

export type UpdateInventoryItemInput =
  z.infer<
    typeof updateInventoryItemSchema
  >;