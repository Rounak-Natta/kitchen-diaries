"use server";

import {
  Role,
  Prisma,
} from "@prisma/client";
import {
  revalidatePath,
} from "next/cache";

import {
  hashPassword,
} from "@/lib/auth";
import {
  writeAuditLog,
} from "@/lib/audit-log";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
  type Permission,
} from "@/lib/rbac";
import {
  withSerializableTransaction,
} from "@/lib/transaction";

import {
  canManageTargetRole,
  getAssignableRoles,
} from "../lib/user-access";
import {
  createRestaurantUserSchema,
  setRestaurantUserActiveSchema,
  updateRestaurantUserSchema,
  type CreateRestaurantUserInput,
  type SetRestaurantUserActiveInput,
  type UpdateRestaurantUserInput,
} from "../validations/user-schemas";

export type UserActionResult =
  | {
      success: true;
      message: string;
      userId: string;
    }
  | {
      success: false;
      error: string;
    };

class UserManagementError extends Error {}

interface UserActor {
  id: string;
  restaurantId: string;
  role: Role;
}

async function requireUserActor(
  permission: Permission,
): Promise<UserActor> {
  const user =
    await getAuthUser();

  if (!user) {
    throw new UserManagementError(
      "Unauthorized.",
    );
  }

  if (
    !hasPermission(
      user.role,
      permission,
    )
  ) {
    throw new UserManagementError(
      "You do not have permission to perform this user-management operation.",
    );
  }

  if (!user.restaurantId) {
    throw new UserManagementError(
      "No restaurant is assigned to this user.",
    );
  }

  return {
    id: user.id,
    restaurantId:
      user.restaurantId,
    role: user.role,
  };
}

function assertRoleAssignable(
  actorRole: Role,
  selectedRole: Role,
): void {
  const assignableRoles =
    getAssignableRoles(
      actorRole,
    );

  if (
    !assignableRoles.includes(
      selectedRole,
    )
  ) {
    throw new UserManagementError(
      "You cannot assign the selected role.",
    );
  }
}

function assertTargetManageable(
  actorRole: Role,
  targetRole: Role,
): void {
  if (
    !canManageTargetRole(
      actorRole,
      targetRole,
    )
  ) {
    throw new UserManagementError(
      "Only an owner can manage another owner account.",
    );
  }
}

async function assertAnotherActiveOwnerExists(
  transaction:
    Prisma.TransactionClient,
  restaurantId: string,
  excludedUserId: string,
): Promise<void> {
  const otherActiveOwners =
    await transaction.user.count({
      where: {
        restaurantId,
        role: Role.OWNER,
        isActive: true,

        id: {
          not:
            excludedUserId,
        },
      },
    });

  if (
    otherActiveOwners < 1
  ) {
    throw new UserManagementError(
      "The restaurant must retain at least one active owner.",
    );
  }
}

function isUniqueConstraintError(
  error: unknown,
): boolean {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function getActionError(
  error: unknown,
): string {
  if (
    error instanceof
    UserManagementError
  ) {
    return error.message;
  }

  return "The user-management operation could not be completed.";
}

export async function createRestaurantUser(
  data: CreateRestaurantUserInput,
): Promise<UserActionResult> {
  try {
    const actor =
      await requireUserActor(
        PERMISSIONS.USERS_CREATE,
      );

    const validation =
      createRestaurantUserSchema.safeParse(
        data,
      );

    if (!validation.success) {
      return {
        success: false,

        error:
          validation.error.issues[0]
            ?.message ??
          "Invalid user information.",
      };
    }

    const input =
      validation.data;

    assertRoleAssignable(
      actor.role,
      input.role,
    );

    const passwordHash =
      await hashPassword(
        input.password,
      );

    const user =
      await withSerializableTransaction(
        async (transaction) => {
          const createdUser =
            await transaction.user.create({
              data: {
                name: input.name,
                email: input.email,
                password:
                  passwordHash,
                role: input.role,
                isActive:
                  input.isActive,

                restaurantId:
                  actor.restaurantId,
              },

              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
              },
            });

          await writeAuditLog(
            transaction,
            {
              restaurantId:
                actor.restaurantId,

              userId:
                actor.id,

              module: "USERS",
              action:
                "CREATE_USER",

              entityType:
                "User",

              entityId:
                createdUser.id,

              newData: {
                name:
                  createdUser.name,

                email:
                  createdUser.email,

                role:
                  createdUser.role,

                isActive:
                  createdUser.isActive,
              },
            },
          );

          return createdUser;
        },
      );

    revalidatePath(
      "/users",
    );

    return {
      success: true,
      userId: user.id,
      message:
        "User created successfully.",
    };
  } catch (error: unknown) {
    if (
      isUniqueConstraintError(
        error,
      )
    ) {
      return {
        success: false,
        error:
          "A user with this email address already exists.",
      };
    }

    console.error(
      "CREATE_RESTAURANT_USER_ERROR:",
      error,
    );

    return {
      success: false,
      error:
        getActionError(error),
    };
  }
}

export async function updateRestaurantUser(
  userId: string,
  data: UpdateRestaurantUserInput,
): Promise<UserActionResult> {
  try {
    const actor =
      await requireUserActor(
        PERMISSIONS.USERS_UPDATE,
      );

    const validation =
      updateRestaurantUserSchema.safeParse(
        data,
      );

    if (!validation.success) {
      return {
        success: false,

        error:
          validation.error.issues[0]
            ?.message ??
          "Invalid user information.",
      };
    }

    const input =
      validation.data;

    assertRoleAssignable(
      actor.role,
      input.role,
    );

    const passwordHash =
      input.newPassword
        ? await hashPassword(
            input.newPassword,
          )
        : null;

    const updatedUser =
      await withSerializableTransaction(
        async (transaction) => {
          const existingUser =
            await transaction.user.findFirst({
              where: {
                id: userId,

                restaurantId:
                  actor.restaurantId,
              },

              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
              },
            });

          if (!existingUser) {
            throw new UserManagementError(
              "User was not found.",
            );
          }

          assertTargetManageable(
            actor.role,
            existingUser.role,
          );

          if (
            existingUser.id ===
              actor.id &&
            existingUser.role !==
              input.role
          ) {
            throw new UserManagementError(
              "You cannot change your own role.",
            );
          }

          if (
            existingUser.role ===
              Role.OWNER &&
            input.role !==
              Role.OWNER &&
            existingUser.isActive
          ) {
            await assertAnotherActiveOwnerExists(
              transaction,
              actor.restaurantId,
              existingUser.id,
            );
          }

          const updateData:
            Prisma.UserUpdateInput = {
            name: input.name,
            email: input.email,
            role: input.role,
          };

          if (passwordHash) {
            updateData.password =
              passwordHash;
          }

          const user =
            await transaction.user.update({
              where: {
                id: existingUser.id,
              },

              data:
                updateData,

              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
              },
            });

          await writeAuditLog(
            transaction,
            {
              restaurantId:
                actor.restaurantId,

              userId:
                actor.id,

              module: "USERS",
              action:
                "UPDATE_USER",

              entityType:
                "User",

              entityId:
                user.id,

              oldData: {
                name:
                  existingUser.name,

                email:
                  existingUser.email,

                role:
                  existingUser.role,

                isActive:
                  existingUser.isActive,
              },

              newData: {
                name:
                  user.name,

                email:
                  user.email,

                role:
                  user.role,

                isActive:
                  user.isActive,

                passwordChanged:
                  Boolean(
                    passwordHash,
                  ),
              },
            },
          );

          return user;
        },
      );

    revalidatePath(
      "/users",
    );

    revalidatePath(
      `/users/${userId}/edit`,
    );

    return {
      success: true,

      userId:
        updatedUser.id,

      message:
        "User updated successfully.",
    };
  } catch (error: unknown) {
    if (
      isUniqueConstraintError(
        error,
      )
    ) {
      return {
        success: false,
        error:
          "A user with this email address already exists.",
      };
    }

    console.error(
      "UPDATE_RESTAURANT_USER_ERROR:",
      error,
    );

    return {
      success: false,
      error:
        getActionError(error),
    };
  }
}

export async function setRestaurantUserActive(
  userId: string,
  data: SetRestaurantUserActiveInput,
): Promise<UserActionResult> {
  try {
    const actor =
      await requireUserActor(
        PERMISSIONS.USERS_DEACTIVATE,
      );

    const validation =
      setRestaurantUserActiveSchema.safeParse(
        data,
      );

    if (!validation.success) {
      return {
        success: false,

        error:
          validation.error.issues[0]
            ?.message ??
          "Invalid status information.",
      };
    }

    const input =
      validation.data;

    const result =
      await withSerializableTransaction(
        async (transaction) => {
          const existingUser =
            await transaction.user.findFirst({
              where: {
                id: userId,

                restaurantId:
                  actor.restaurantId,
              },

              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
              },
            });

          if (!existingUser) {
            throw new UserManagementError(
              "User was not found.",
            );
          }

          assertTargetManageable(
            actor.role,
            existingUser.role,
          );

          if (
            existingUser.id ===
            actor.id
          ) {
            throw new UserManagementError(
              "You cannot deactivate or reactivate your own account.",
            );
          }

          if (
            existingUser.isActive ===
            input.isActive
          ) {
            return {
              user:
                existingUser,

              changed: false,
            };
          }

          if (
            !input.isActive &&
            existingUser.role ===
              Role.OWNER
          ) {
            await assertAnotherActiveOwnerExists(
              transaction,
              actor.restaurantId,
              existingUser.id,
            );
          }

          const user =
            await transaction.user.update({
              where: {
                id: existingUser.id,
              },

              data: {
                isActive:
                  input.isActive,
              },

              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
              },
            });

          await writeAuditLog(
            transaction,
            {
              restaurantId:
                actor.restaurantId,

              userId:
                actor.id,

              module: "USERS",

              action:
                input.isActive
                  ? "ACTIVATE_USER"
                  : "DEACTIVATE_USER",

              entityType:
                "User",

              entityId:
                user.id,

              oldData: {
                name:
                  existingUser.name,

                email:
                  existingUser.email,

                role:
                  existingUser.role,

                isActive:
                  existingUser.isActive,
              },

              newData: {
                name:
                  user.name,

                email:
                  user.email,

                role:
                  user.role,

                isActive:
                  user.isActive,
              },

              reason:
                input.reason ??
                null,
            },
          );

          return {
            user,
            changed: true,
          };
        },
      );

    revalidatePath(
      "/users",
    );

    revalidatePath(
      `/users/${userId}/edit`,
    );

    return {
      success: true,

      userId:
        result.user.id,

      message:
        result.changed
          ? result.user.isActive
            ? "User activated successfully."
            : "User deactivated successfully."
          : "User status is already unchanged.",
    };
  } catch (error: unknown) {
    console.error(
      "SET_RESTAURANT_USER_ACTIVE_ERROR:",
      error,
    );

    return {
      success: false,
      error:
        getActionError(error),
    };
  }
}