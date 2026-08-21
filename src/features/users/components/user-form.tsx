"use client";

import type {
  Role,
} from "@prisma/client";
import Link from "next/link";
import {
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  Loader2,
} from "lucide-react";
import {
  useRouter,
} from "next/navigation";

import {
  createRestaurantUser,
  updateRestaurantUser,
} from "../actions/user-actions";
import type {
  RestaurantUserEditorDto,
} from "../types";
import type {
  UpdateRestaurantUserInput,
} from "../validations/user-schemas";

interface UserFormProps {
  mode:
    | "create"
    | "edit";

  user?:
    RestaurantUserEditorDto;

  allowedRoles:
    readonly Role[];

  roleLocked?: boolean;
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

export function UserForm({
  mode,
  user,
  allowedRoles,
  roleLocked = false,
}: UserFormProps) {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    name,
    setName,
  ] = useState(
    user?.name ?? "",
  );

  const [
    email,
    setEmail,
  ] = useState(
    user?.email ?? "",
  );

  const [
    role,
    setRole,
  ] = useState<Role>(
    user?.role ??
      allowedRoles[0] ??
      "STEWARD",
  );

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    isActive,
    setIsActive,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<
    string | null
  >(null);

  function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    if (pending) {
      return;
    }

    setErrorMessage(null);

    startTransition(
      async () => {
        const result =
          mode === "create"
            ? await createRestaurantUser(
                {
                  name,
                  email,
                  role,
                  password,
                  isActive,
                },
              )
            : await updateRestaurantUser(
                user!.id,
                (() => {
                  const input:
                    UpdateRestaurantUserInput =
                    {
                      name,
                      email,
                      role,
                    };

                  if (
                    password.trim()
                  ) {
                    input.newPassword =
                      password;
                  }

                  return input;
                })(),
              );

        if (!result.success) {
          setErrorMessage(
            result.error,
          );

          return;
        }

        router.push(
          "/users",
        );

        router.refresh();
      },
    );
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="space-y-6 rounded-xl border bg-card p-5 shadow-sm"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label
            htmlFor="user-name"
            className="text-sm font-medium"
          >
            Full Name
          </label>

          <input
            id="user-name"
            value={name}
            maxLength={100}
            required
            disabled={pending}
            onChange={(
              event,
            ) =>
              setName(
                event.target
                  .value,
              )
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label
            htmlFor="user-email"
            className="text-sm font-medium"
          >
            Email Address
          </label>

          <input
            id="user-email"
            type="email"
            value={email}
            maxLength={254}
            required
            disabled={pending}
            onChange={(
              event,
            ) =>
              setEmail(
                event.target
                  .value,
              )
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label
            htmlFor="user-role"
            className="text-sm font-medium"
          >
            Role
          </label>

          <select
            id="user-role"
            value={role}
            disabled={
              pending ||
              roleLocked
            }
            onChange={(
              event,
            ) =>
              setRole(
                event.target
                  .value as Role,
              )
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {allowedRoles.map(
              (
                roleOption,
              ) => (
                <option
                  key={
                    roleOption
                  }
                  value={
                    roleOption
                  }
                >
                  {formatLabel(
                    roleOption,
                  )}
                </option>
              ),
            )}
          </select>

          {roleLocked && (
            <p className="mt-1 text-xs text-muted-foreground">
              You cannot change
              your own role.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="user-password"
            className="text-sm font-medium"
          >
            {mode ===
            "create"
              ? "Password"
              : "New Password"}
          </label>

          <input
            id="user-password"
            type="password"
            value={password}
            minLength={
              mode ===
              "create"
                ? 10
                : undefined
            }
            maxLength={72}
            required={
              mode ===
              "create"
            }
            disabled={pending}
            autoComplete="new-password"
            onChange={(
              event,
            ) =>
              setPassword(
                event.target
                  .value,
              )
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />

          <p className="mt-1 text-xs text-muted-foreground">
            Minimum 10
            characters with at
            least one letter and
            one number.
            {mode === "edit"
              ? " Leave blank to keep the current password."
              : ""}
          </p>
        </div>
      </div>

      {mode ===
        "create" && (
        <label className="flex items-center gap-3 rounded-md border p-4">
          <input
            type="checkbox"
            checked={
              isActive
            }
            disabled={
              pending
            }
            onChange={(
              event,
            ) =>
              setIsActive(
                event.target
                  .checked,
              )
            }
            className="size-4"
          />

          <span>
            <span className="block text-sm font-medium">
              Active account
            </span>

            <span className="block text-xs text-muted-foreground">
              The user can log in
              immediately.
            </span>
          </span>
        </label>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      )}

      <div className="flex flex-wrap gap-3 border-t pt-5">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}

          {mode ===
          "create"
            ? "Create User"
            : "Save Changes"}
        </button>

        <Link
          href="/users"
          className="inline-flex h-10 items-center justify-center rounded-md border px-5 text-sm font-medium transition hover:bg-muted"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}