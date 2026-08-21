import {
  PERMISSIONS,
  type Permission,
  type PermissionGrant,
} from "./permissions";
import {
  Roles,
  type Roles as RoleValue,
} from "./roles";

// ======================================================
// SHARED PERMISSION GROUPS
// ======================================================

const MENU_READ_PERMISSIONS =
  [
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.VARIATION_VIEW,
    PERMISSIONS.ADDON_VIEW,
  ] satisfies readonly Permission[];

const MENU_MANAGEMENT_PERMISSIONS =
  [
    ...MENU_READ_PERMISSIONS,

    PERMISSIONS.MENU_CREATE,
    PERMISSIONS.MENU_UPDATE,
    PERMISSIONS.MENU_DELETE,

    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_UPDATE,
    PERMISSIONS.CATEGORY_DELETE,
    PERMISSIONS.CATEGORY_MANAGE,

    PERMISSIONS.VARIATION_CREATE,
    PERMISSIONS.VARIATION_UPDATE,
    PERMISSIONS.VARIATION_DELETE,

    PERMISSIONS.ADDON_CREATE,
    PERMISSIONS.ADDON_UPDATE,
    PERMISSIONS.ADDON_DELETE,
  ] satisfies readonly Permission[];

const ORDER_OPERATION_PERMISSIONS =
  [
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.ORDERS_STATUS_UPDATE,
  ] satisfies readonly Permission[];

const BILLING_OPERATION_PERMISSIONS =
  [
    PERMISSIONS.BILLING_CREATE,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.BILLING_PAYMENT_ADD,
  ] satisfies readonly Permission[];

const INVENTORY_READ_PERMISSIONS =
  [
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_LEDGER_READ,
  ] satisfies readonly Permission[];

const INVENTORY_MANAGEMENT_PERMISSIONS =
  [
    ...INVENTORY_READ_PERMISSIONS,

    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.INVENTORY_STOCK_IN,
    PERMISSIONS.INVENTORY_ADJUST,
  ] satisfies readonly Permission[];

const RECIPE_MANAGEMENT_PERMISSIONS =
  [
    PERMISSIONS.RECIPE_VIEW,
    PERMISSIONS.RECIPE_CREATE,
    PERMISSIONS.RECIPE_UPDATE,
    PERMISSIONS.RECIPE_DELETE,
  ] satisfies readonly Permission[];

const WASTAGE_MANAGEMENT_PERMISSIONS =
  [
    PERMISSIONS.WASTAGE_READ,
    PERMISSIONS.WASTAGE_CREATE,
    PERMISSIONS.WASTAGE_POST,
    PERMISSIONS.WASTAGE_CANCEL,
  ] satisfies readonly Permission[];

const USER_MANAGEMENT_PERMISSIONS =
  [
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DEACTIVATE,
  ] satisfies readonly Permission[];

const REPORTING_PERMISSIONS =
  [
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
  ] satisfies readonly Permission[];

// ======================================================
// ROLE-PERMISSION MAP
// ======================================================

export const ROLE_PERMISSIONS: Record<
  RoleValue,
  readonly PermissionGrant[]
> = {
  // ====================================================
  // OWNER
  // Full system access
  // ====================================================

  [Roles.OWNER]: ["*"],

  // ====================================================
  // MANAGER
  // Full restaurant operations except owner-only settings
  // ====================================================

  [Roles.MANAGER]: [
    PERMISSIONS.DASHBOARD_ACCESS,

    ...MENU_MANAGEMENT_PERMISSIONS,

    ...ORDER_OPERATION_PERMISSIONS,
    PERMISSIONS.ORDERS_CANCEL,

    ...BILLING_OPERATION_PERMISSIONS,
    PERMISSIONS.BILLING_CANCEL,
    PERMISSIONS.BILLING_REFUND,

    ...INVENTORY_MANAGEMENT_PERMISSIONS,

    ...RECIPE_MANAGEMENT_PERMISSIONS,

    ...WASTAGE_MANAGEMENT_PERMISSIONS,

    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.PROFIT_ANALYTICS_READ,

    ...REPORTING_PERMISSIONS,

    PERMISSIONS.AUDIT_LOG_READ,

    ...USER_MANAGEMENT_PERMISSIONS,

    PERMISSIONS.SETTINGS_READ,

    PERMISSIONS.DATA_EXPORT,
  ],

  // ====================================================
  // CASHIER
  // Orders, billing and basic operational visibility
  // ====================================================

  [Roles.CASHIER]: [
    PERMISSIONS.DASHBOARD_ACCESS,

    ...MENU_READ_PERMISSIONS,

    ...ORDER_OPERATION_PERMISSIONS,

    ...BILLING_OPERATION_PERMISSIONS,

    PERMISSIONS.INVENTORY_VIEW,

    PERMISSIONS.REPORTS_READ,
  ],

  // ====================================================
  // STEWARD
  // Order taking and order-status operations
  // ====================================================

  [Roles.STEWARD]: [
    PERMISSIONS.DASHBOARD_ACCESS,

    ...MENU_READ_PERMISSIONS,

    ...ORDER_OPERATION_PERMISSIONS,

    PERMISSIONS.BILLING_READ,
  ],

  // ====================================================
  // KITCHEN
  // Kitchen order flow, recipes and wastage entry
  // ====================================================

  [Roles.KITCHEN]: [
    PERMISSIONS.DASHBOARD_ACCESS,

    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.CATEGORY_VIEW,

    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_STATUS_UPDATE,

    PERMISSIONS.INVENTORY_VIEW,

    PERMISSIONS.RECIPE_VIEW,

    PERMISSIONS.WASTAGE_READ,
    PERMISSIONS.WASTAGE_CREATE,
  ],

  // ====================================================
  // STORE KEEPER
  // Inventory, stock movements, recipes and wastage
  // ====================================================

  [Roles.STORE_KEEPER]: [
    PERMISSIONS.DASHBOARD_ACCESS,

    ...INVENTORY_MANAGEMENT_PERMISSIONS,

    PERMISSIONS.RECIPE_VIEW,

    PERMISSIONS.WASTAGE_READ,
    PERMISSIONS.WASTAGE_CREATE,
    PERMISSIONS.WASTAGE_POST,

    ...REPORTING_PERMISSIONS,

    PERMISSIONS.DATA_EXPORT,
  ],
};