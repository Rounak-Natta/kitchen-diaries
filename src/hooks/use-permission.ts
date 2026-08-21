"use client";

import {
  hasPermission,
  type Permission,
  type Roles,
} from "@/lib/rbac";

// Keep your existing auth/user hook import here.

export function usePermission(
  permission: Permission
): boolean {
  // Replace this with your existing source of the current role.
  const role: Roles | string | null | undefined =
    undefined;

  return hasPermission(
    role,
    permission
  );
}