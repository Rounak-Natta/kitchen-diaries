"use client";

import {
  Loader2,
  Power,
  PowerOff,
} from "lucide-react";
import {
  useTransition,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  setRestaurantUserActive,
} from "../actions/user-actions";

interface UserStatusButtonProps {
  userId: string;
  userName: string;
  isActive: boolean;
  disabled: boolean;
}

export function UserStatusButton({
  userId,
  userName,
  isActive,
  disabled,
}: UserStatusButtonProps) {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  function handleClick(): void {
    if (
      pending ||
      disabled
    ) {
      return;
    }

    let reason:
      string | undefined;

    if (isActive) {
      const enteredReason =
        window.prompt(
          `Enter the reason for deactivating ${userName}:`,
        );

      if (
        enteredReason ===
        null
      ) {
        return;
      }

      reason =
        enteredReason.trim();

      if (
        reason.length < 3
      ) {
        window.alert(
          "A reason of at least 3 characters is required.",
        );

        return;
      }
    } else {
      const confirmed =
        window.confirm(
          `Activate ${userName}?`,
        );

      if (!confirmed) {
        return;
      }
    }

    startTransition(
      async () => {
        const result =
          await setRestaurantUserActive(
            userId,
            {
              isActive:
                !isActive,

              ...(reason
                ? {
                    reason,
                  }
                : {}),
            },
          );

        if (!result.success) {
          window.alert(
            result.error,
          );

          return;
        }

        router.refresh();
      },
    );
  }

  return (
    <button
      type="button"
      disabled={
        disabled ||
        pending
      }
      onClick={handleClick}
      className={
        isActive
          ? "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          : "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-emerald-200 px-3 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
      }
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isActive ? (
        <PowerOff className="h-4 w-4" />
      ) : (
        <Power className="h-4 w-4" />
      )}

      {isActive
        ? "Deactivate"
        : "Activate"}
    </button>
  );
}