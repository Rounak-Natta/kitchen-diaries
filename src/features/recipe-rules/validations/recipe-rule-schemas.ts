import { z } from "zod";

const optionalNotesSchema =
  z
    .string()
    .trim()
    .max(500)
    .optional();

const inventoryItemIdSchema =
  z
    .string()
    .trim()
    .min(
      1,
      "Inventory item is required.",
    );

export const variationRecipeRuleSchema =
  z
    .object({
      inventoryItemId:
        inventoryItemIdSchema,

      adjustmentType:
        z.enum([
          "ADD",
          "REPLACE",
          "REMOVE",
        ]),

      quantity: z
        .number()
        .finite()
        .min(0)
        .max(999_999_999),

      notes:
        optionalNotesSchema,
    })
    .strict()
    .superRefine(
      (data, context) => {
        if (
          data.adjustmentType !==
            "REMOVE" &&
          data.quantity <= 0
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: ["quantity"],

            message:
              "Quantity must be greater than zero for add and replace rules.",
          });
        }
      },
    );

export const saveVariationRecipeRulesSchema =
  z
    .object({
      variationOptionId: z
        .string()
        .trim()
        .min(
          1,
          "Variation option is required.",
        ),

      rules: z
        .array(
          variationRecipeRuleSchema,
        )
        .max(100),
    })
    .strict()
    .superRefine(
      (data, context) => {
        const seen =
          new Set<string>();

        data.rules.forEach(
          (rule, index) => {
            if (
              seen.has(
                rule.inventoryItemId,
              )
            ) {
              context.addIssue({
                code:
                  z.ZodIssueCode.custom,

                path: [
                  "rules",
                  index,
                  "inventoryItemId",
                ],

                message:
                  "The same inventory item cannot be added twice.",
              });
            }

            seen.add(
              rule.inventoryItemId,
            );
          },
        );
      },
    );

export const addonRecipeRuleSchema =
  z
    .object({
      inventoryItemId:
        inventoryItemIdSchema,

      quantity: z
        .number()
        .finite()
        .positive(
          "Add-on ingredient quantity must be greater than zero.",
        )
        .max(999_999_999),

      notes:
        optionalNotesSchema,
    })
    .strict();

export const saveAddonRecipeRulesSchema =
  z
    .object({
      addonId: z
        .string()
        .trim()
        .min(
          1,
          "Add-on is required.",
        ),

      rules: z
        .array(
          addonRecipeRuleSchema,
        )
        .max(100),
    })
    .strict()
    .superRefine(
      (data, context) => {
        const seen =
          new Set<string>();

        data.rules.forEach(
          (rule, index) => {
            if (
              seen.has(
                rule.inventoryItemId,
              )
            ) {
              context.addIssue({
                code:
                  z.ZodIssueCode.custom,

                path: [
                  "rules",
                  index,
                  "inventoryItemId",
                ],

                message:
                  "The same inventory item cannot be added twice.",
              });
            }

            seen.add(
              rule.inventoryItemId,
            );
          },
        );
      },
    );

export type SaveVariationRecipeRulesInput =
  z.infer<
    typeof saveVariationRecipeRulesSchema
  >;

export type SaveAddonRecipeRulesInput =
  z.infer<
    typeof saveAddonRecipeRulesSchema
  >;