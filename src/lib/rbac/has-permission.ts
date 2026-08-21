import {
  ROLE_PERMISSIONS,
} from "./access";

import {
  type Permission,
  type PermissionGrant,
} from "./permissions";

import {
  isRole,
  type Roles,
} from "./roles";

// ======================================================
// PERMISSION ERROR
// ======================================================

export class PermissionError extends Error {
  readonly code = "FORBIDDEN";

  readonly statusCode = 403;

  constructor(
    message =
      "You do not have permission to perform this action"
  ) {
    super(message);

    this.name = "PermissionError";
  }
}

// ======================================================
// GET ROLE PERMISSIONS
// ======================================================

export function getPermissionsForRole(
  role:
    | Roles
    | string
    | null
    | undefined
): readonly PermissionGrant[] {
  if (!isRole(role)) {
    return [];
  }

  return ROLE_PERMISSIONS[role];
}

// ======================================================
// CHECK ONE PERMISSION
// ======================================================

export function hasPermission(
  role:
    | Roles
    | string
    | null
    | undefined,
  permission: Permission
): boolean {
  const permissions =
    getPermissionsForRole(role);

  if (permissions.includes("*")) {
    return true;
  }

  return permissions.includes(
    permission
  );
}

// ======================================================
// CHECK ANY PERMISSION
// ======================================================

export function hasAnyPermission(
  role:
    | Roles
    | string
    | null
    | undefined,
  permissions: readonly Permission[]
): boolean {
  return permissions.some(
    (permission) =>
      hasPermission(
        role,
        permission
      )
  );
}

// ======================================================
// CHECK ALL PERMISSIONS
// ======================================================

export function hasAllPermissions(
  role:
    | Roles
    | string
    | null
    | undefined,
  permissions: readonly Permission[]
): boolean {
  return permissions.every(
    (permission) =>
      hasPermission(
        role,
        permission
      )
  );
}

// ======================================================
// REQUIRE ONE PERMISSION
// ======================================================

export function requirePermission(
  role:
    | Roles
    | string
    | null
    | undefined,
  permission: Permission,
  message?: string
): void {
  if (
    !hasPermission(
      role,
      permission
    )
  ) {
    throw new PermissionError(
      message
    );
  }
}

// ======================================================
// REQUIRE ANY PERMISSION
// ======================================================

export function requireAnyPermission(
  role:
    | Roles
    | string
    | null
    | undefined,
  permissions: readonly Permission[],
  message?: string
): void {
  if (
    !hasAnyPermission(
      role,
      permissions
    )
  ) {
    throw new PermissionError(
      message
    );
  }
}

// ======================================================
// REQUIRE ALL PERMISSIONS
// ======================================================

export function requireAllPermissions(
  role:
    | Roles
    | string
    | null
    | undefined,
  permissions: readonly Permission[],
  message?: string
): void {
  if (
    !hasAllPermissions(
      role,
      permissions
    )
  ) {
    throw new PermissionError(
      message
    );
  }
}