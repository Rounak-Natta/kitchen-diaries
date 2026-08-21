export const PERMISSIONS = {
  // ======================================================
  // DASHBOARD
  // ======================================================

  DASHBOARD_ACCESS:
    "dashboard.access",

  // ======================================================
  // ORDERS
  // ======================================================

  ORDERS_CREATE:
    "orders.create",

  ORDERS_READ:
    "orders.read",

  ORDERS_UPDATE:
    "orders.update",

  ORDERS_STATUS_UPDATE:
    "orders.status.update",

  ORDERS_CANCEL:
    "orders.cancel",

  ORDERS_DELETE:
    "orders.delete",

  // ======================================================
  // BILLING
  // ======================================================

  BILLING_CREATE:
    "billing.create",

  BILLING_READ:
    "billing.read",

  BILLING_PAYMENT_ADD:
    "billing.payment.add",

  BILLING_CANCEL:
    "billing.cancel",

  BILLING_REFUND:
    "billing.refund",

  // ======================================================
  // CATEGORIES
  // ======================================================

  CATEGORY_VIEW:
    "category.view",

  CATEGORY_CREATE:
    "category.create",

  CATEGORY_UPDATE:
    "category.update",

  CATEGORY_DELETE:
    "category.delete",

  /**
   * Preserved for compatibility with existing routes.
   * New code should preferably use the individual permissions.
   */
  CATEGORY_MANAGE:
    "category.manage",

  // ======================================================
  // MENU
  // ======================================================

  MENU_VIEW:
    "menu.view",

  MENU_CREATE:
    "menu.create",

  MENU_UPDATE:
    "menu.update",

  MENU_DELETE:
    "menu.delete",

  // ======================================================
  // VARIATIONS
  // ======================================================

  VARIATION_VIEW:
    "variation.view",

  VARIATION_CREATE:
    "variation.create",

  VARIATION_UPDATE:
    "variation.update",

  VARIATION_DELETE:
    "variation.delete",

  // ======================================================
  // ADD-ONS
  // ======================================================

  ADDON_VIEW:
    "addon.view",

  ADDON_CREATE:
    "addon.create",

  ADDON_UPDATE:
    "addon.update",

  ADDON_DELETE:
    "addon.delete",

  // ======================================================
  // INVENTORY
  // ======================================================

  INVENTORY_VIEW:
    "inventory.view",

  INVENTORY_CREATE:
    "inventory.create",

  INVENTORY_UPDATE:
    "inventory.update",

  INVENTORY_STOCK_IN:
    "inventory.stock.in",

  INVENTORY_ADJUST:
    "inventory.adjust",

  INVENTORY_LEDGER_READ:
    "inventory.ledger.read",

  // ======================================================
  // RECIPES
  // ======================================================

  RECIPE_VIEW:
    "recipe.view",

  RECIPE_CREATE:
    "recipe.create",

  RECIPE_UPDATE:
    "recipe.update",

  RECIPE_DELETE:
    "recipe.delete",

  // ======================================================
  // WASTAGE
  // ======================================================

  WASTAGE_READ:
    "wastage.read",

  WASTAGE_CREATE:
    "wastage.create",

  WASTAGE_POST:
    "wastage.post",

  WASTAGE_CANCEL:
    "wastage.cancel",

  // ======================================================
  // ANALYTICS
  // ======================================================

  ANALYTICS_READ:
    "analytics.read",

  PROFIT_ANALYTICS_READ:
    "analytics.profit.read",

  // ======================================================
  // REPORTS
  // ======================================================

  REPORTS_READ:
    "reports.read",

  REPORTS_EXPORT:
    "reports.export",

  // ======================================================
  // AUDIT LOG
  // ======================================================

  AUDIT_LOG_READ:
    "audit.read",

  // ======================================================
  // USERS
  // ======================================================

  USERS_MANAGE:
    "users.manage",

  USERS_READ:
    "users.read",

  USERS_CREATE:
    "users.create",

  USERS_UPDATE:
    "users.update",

  USERS_DEACTIVATE:
    "users.deactivate",

  // ======================================================
  // SETTINGS
  // ======================================================

  SETTINGS_READ:
    "settings.read",

  SETTINGS_UPDATE:
    "settings.update",

  // ======================================================
  // DATA SAFETY
  // ======================================================

  DATA_EXPORT:
    "data.export",
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionGrant =
  | Permission
  | "*";