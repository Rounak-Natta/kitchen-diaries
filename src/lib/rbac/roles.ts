import { Role } from "@prisma/client";

/**
 * Uses Prisma's Role enum directly so the database schema
 * and application roles cannot become inconsistent.
 *
 * Runtime usage:
 *   Roles.OWNER
 *
 * Type usage:
 *   role: Roles
 */
export const Roles = Role;

export type Roles =
  (typeof Roles)[keyof typeof Roles];

export const ALL_ROLES =
  Object.values(Role) as Roles[];

export function isRole(
  value: unknown
): value is Roles {
  return (
    typeof value === "string" &&
    ALL_ROLES.includes(value as Roles)
  );
}