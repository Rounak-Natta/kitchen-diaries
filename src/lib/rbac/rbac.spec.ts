import {
  describe,
  expect,
  it,
} from "vitest";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

import {
  Roles,
} from "./roles";

describe(
  "role permissions",
  () => {
    describe(
      "OWNER",
      () => {
        it(
          "has unrestricted system access",
          () => {
            expect(
              hasPermission(
                Roles.OWNER,
                PERMISSIONS.SETTINGS_UPDATE,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.OWNER,
                PERMISSIONS.BILLING_REFUND,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.OWNER,
                PERMISSIONS.DATA_EXPORT,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.OWNER,
                PERMISSIONS.USERS_MANAGE,
              ),
            ).toBe(true);
          },
        );
      },
    );

    describe(
      "MANAGER",
      () => {
        it(
          "can manage restaurant users",
          () => {
            expect(
              hasPermission(
                Roles.MANAGER,
                PERMISSIONS.USERS_READ,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.MANAGER,
                PERMISSIONS.USERS_CREATE,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.MANAGER,
                PERMISSIONS.USERS_UPDATE,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.MANAGER,
                PERMISSIONS.USERS_DEACTIVATE,
              ),
            ).toBe(true);
          },
        );

        it(
          "can read but cannot update owner-only restaurant settings",
          () => {
            expect(
              hasPermission(
                Roles.MANAGER,
                PERMISSIONS.SETTINGS_READ,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.MANAGER,
                PERMISSIONS.SETTINGS_UPDATE,
              ),
            ).toBe(false);
          },
        );

        it(
          "can cancel bills and issue refunds",
          () => {
            expect(
              hasPermission(
                Roles.MANAGER,
                PERMISSIONS.BILLING_CANCEL,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.MANAGER,
                PERMISSIONS.BILLING_REFUND,
              ),
            ).toBe(true);
          },
        );
      },
    );

    describe(
      "CASHIER",
      () => {
        it(
          "can create bills and record payments",
          () => {
            expect(
              hasPermission(
                Roles.CASHIER,
                PERMISSIONS.BILLING_CREATE,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.CASHIER,
                PERMISSIONS.BILLING_READ,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.CASHIER,
                PERMISSIONS.BILLING_PAYMENT_ADD,
              ),
            ).toBe(true);
          },
        );

        it(
          "cannot cancel bills or issue refunds",
          () => {
            expect(
              hasPermission(
                Roles.CASHIER,
                PERMISSIONS.BILLING_CANCEL,
              ),
            ).toBe(false);

            expect(
              hasPermission(
                Roles.CASHIER,
                PERMISSIONS.BILLING_REFUND,
              ),
            ).toBe(false);
          },
        );

        it(
          "cannot manage users",
          () => {
            expect(
              hasPermission(
                Roles.CASHIER,
                PERMISSIONS.USERS_CREATE,
              ),
            ).toBe(false);

            expect(
              hasPermission(
                Roles.CASHIER,
                PERMISSIONS.USERS_UPDATE,
              ),
            ).toBe(false);
          },
        );
      },
    );

    describe(
      "STEWARD",
      () => {
        it(
          "can create and update orders",
          () => {
            expect(
              hasPermission(
                Roles.STEWARD,
                PERMISSIONS.ORDERS_CREATE,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.STEWARD,
                PERMISSIONS.ORDERS_READ,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.STEWARD,
                PERMISSIONS.ORDERS_STATUS_UPDATE,
              ),
            ).toBe(true);
          },
        );

        it(
          "cannot adjust inventory",
          () => {
            expect(
              hasPermission(
                Roles.STEWARD,
                PERMISSIONS.INVENTORY_ADJUST,
              ),
            ).toBe(false);

            expect(
              hasPermission(
                Roles.STEWARD,
                PERMISSIONS.INVENTORY_STOCK_IN,
              ),
            ).toBe(false);
          },
        );

        it(
          "cannot create bills",
          () => {
            expect(
              hasPermission(
                Roles.STEWARD,
                PERMISSIONS.BILLING_CREATE,
              ),
            ).toBe(false);
          },
        );
      },
    );

    describe(
      "KITCHEN",
      () => {
        it(
          "can read and update kitchen order status",
          () => {
            expect(
              hasPermission(
                Roles.KITCHEN,
                PERMISSIONS.ORDERS_READ,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.KITCHEN,
                PERMISSIONS.ORDERS_STATUS_UPDATE,
              ),
            ).toBe(true);
          },
        );

        it(
          "can view recipes and create wastage entries",
          () => {
            expect(
              hasPermission(
                Roles.KITCHEN,
                PERMISSIONS.RECIPE_VIEW,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.KITCHEN,
                PERMISSIONS.WASTAGE_CREATE,
              ),
            ).toBe(true);
          },
        );

        it(
          "cannot create bills or refund payments",
          () => {
            expect(
              hasPermission(
                Roles.KITCHEN,
                PERMISSIONS.BILLING_CREATE,
              ),
            ).toBe(false);

            expect(
              hasPermission(
                Roles.KITCHEN,
                PERMISSIONS.BILLING_REFUND,
              ),
            ).toBe(false);
          },
        );
      },
    );

    describe(
      "STORE_KEEPER",
      () => {
        it(
          "can manage inventory",
          () => {
            expect(
              hasPermission(
                Roles.STORE_KEEPER,
                PERMISSIONS.INVENTORY_VIEW,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.STORE_KEEPER,
                PERMISSIONS.INVENTORY_STOCK_IN,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.STORE_KEEPER,
                PERMISSIONS.INVENTORY_ADJUST,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.STORE_KEEPER,
                PERMISSIONS.INVENTORY_LEDGER_READ,
              ),
            ).toBe(true);
          },
        );

        it(
          "can create and post wastage",
          () => {
            expect(
              hasPermission(
                Roles.STORE_KEEPER,
                PERMISSIONS.WASTAGE_CREATE,
              ),
            ).toBe(true);

            expect(
              hasPermission(
                Roles.STORE_KEEPER,
                PERMISSIONS.WASTAGE_POST,
              ),
            ).toBe(true);
          },
        );

        it(
          "cannot create bills",
          () => {
            expect(
              hasPermission(
                Roles.STORE_KEEPER,
                PERMISSIONS.BILLING_CREATE,
              ),
            ).toBe(false);
          },
        );
      },
    );
  },
);