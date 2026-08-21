import type {
  Role,
} from "@prisma/client";
import Link from "next/link";

import {
  canManageTargetRole,
} from "../lib/user-access";
import type {
  RestaurantUserListItemDto,
} from "../types";
import {
  UserStatusButton,
} from "./user-status-button";

interface UserTableProps {
  users:
    RestaurantUserListItemDto[];

  actorRole: Role;
  currentUserId: string;

  canUpdate: boolean;
  canDeactivate: boolean;
}

function formatLabel(
  value: string,
): string {
  return value
    .toLowerCase()
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function formatDateTime(
  value:
    | string
    | null,
): string {
  if (!value) {
    return "Never";
  }

  return new Date(
    value,
  ).toLocaleString(
    "en-IN",
    {
      timeZone:
        "Asia/Kolkata",

      dateStyle:
        "medium",

      timeStyle:
        "short",
    },
  );
}

export function UserTable({
  users,
  actorRole,
  currentUserId,
  canUpdate,
  canDeactivate,
}: UserTableProps) {
  if (
    users.length === 0
  ) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
        No users were found.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[950px] text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">
                User
              </th>

              <th className="px-4 py-3 font-medium">
                Role
              </th>

              <th className="px-4 py-3 font-medium">
                Status
              </th>

              <th className="px-4 py-3 font-medium">
                Last Login
              </th>

              <th className="px-4 py-3 font-medium">
                Created
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {users.map(
              (user) => {
                const targetManageable =
                  canManageTargetRole(
                    actorRole,
                    user.role,
                  );

                const isSelf =
                  user.id ===
                  currentUserId;

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-muted/20"
                  >
                    <td className="px-4 py-4">
                      <p className="font-medium">
                        {user.name}

                        {isSelf && (
                          <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            You
                          </span>
                        )}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      {formatLabel(
                        user.role,
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={
                          user.isActive
                            ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
                        }
                      >
                        {user.isActive
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-muted-foreground">
                      {formatDateTime(
                        user.lastLoginAt,
                      )}
                    </td>

                    <td className="px-4 py-4 text-muted-foreground">
                      {formatDateTime(
                        user.createdAt,
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        {canUpdate &&
                          targetManageable && (
                            <Link
                              href={`/users/${user.id}/edit`}
                              className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-medium transition hover:bg-muted"
                            >
                              Edit
                            </Link>
                          )}

                        {canDeactivate &&
                          targetManageable && (
                            <UserStatusButton
                              userId={
                                user.id
                              }
                              userName={
                                user.name
                              }
                              isActive={
                                user.isActive
                              }
                              disabled={
                                isSelf
                              }
                            />
                          )}
                      </div>
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}