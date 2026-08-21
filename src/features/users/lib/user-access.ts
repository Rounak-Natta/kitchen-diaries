import {
  Role,
} from "@prisma/client";

export const ALL_USER_ROLES =
  [
    Role.OWNER,
    Role.MANAGER,
    Role.CASHIER,
    Role.STEWARD,
    Role.KITCHEN,
    Role.STORE_KEEPER,
  ] as const satisfies readonly Role[];

export const NON_OWNER_USER_ROLES =
  [
    Role.MANAGER,
    Role.CASHIER,
    Role.STEWARD,
    Role.KITCHEN,
    Role.STORE_KEEPER,
  ] as const satisfies readonly Role[];

export function getAssignableRoles(
  actorRole: Role,
): readonly Role[] {
  return actorRole === Role.OWNER
    ? ALL_USER_ROLES
    : NON_OWNER_USER_ROLES;
}

export function canManageTargetRole(
  actorRole: Role,
  targetRole: Role,
): boolean {
  return (
    actorRole === Role.OWNER ||
    targetRole !== Role.OWNER
  );
}