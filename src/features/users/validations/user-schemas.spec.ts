import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createRestaurantUserSchema,
  setRestaurantUserActiveSchema,
  updateRestaurantUserSchema,
} from "./user-schemas";

describe(
  "user validation",
  () => {
    it(
      "normalizes a valid user",
      () => {
        const result =
          createRestaurantUserSchema.safeParse(
            {
              name:
                "  Test Manager  ",

              email:
                "MANAGER@EXAMPLE.COM",

              role:
                "MANAGER",

              password:
                "StrongPass123",

              isActive:
                true,
            },
          );

        expect(
          result.success,
        ).toBe(true);

        if (
          result.success
        ) {
          expect(
            result.data.name,
          ).toBe(
            "Test Manager",
          );

          expect(
            result.data.email,
          ).toBe(
            "manager@example.com",
          );
        }
      },
    );

    it(
      "rejects weak passwords",
      () => {
        const result =
          createRestaurantUserSchema.safeParse(
            {
              name:
                "Test User",

              email:
                "user@example.com",

              role:
                "STEWARD",

              password:
                "password",

              isActive:
                true,
            },
          );

        expect(
          result.success,
        ).toBe(false);
      },
    );

    it(
      "allows an edit without changing the password",
      () => {
        const result =
          updateRestaurantUserSchema.safeParse(
            {
              name:
                "Updated User",

              email:
                "updated@example.com",

              role:
                "CASHIER",
            },
          );

        expect(
          result.success,
        ).toBe(true);
      },
    );

    it(
      "requires a reason when deactivating a user",
      () => {
        const result =
          setRestaurantUserActiveSchema.safeParse(
            {
              isActive:
                false,
            },
          );

        expect(
          result.success,
        ).toBe(false);
      },
    );

    it(
      "does not require a reason when activating a user",
      () => {
        const result =
          setRestaurantUserActiveSchema.safeParse(
            {
              isActive:
                true,
            },
          );

        expect(
          result.success,
        ).toBe(true);
      },
    );
  },
);