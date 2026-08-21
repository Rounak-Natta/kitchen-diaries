"use client";

import {
  LogOut,
  Loader2,
} from "lucide-react";
import {
  useRouter,
} from "next/navigation";
import {
  useTransition,
} from "react";
import { clearLocalSession } from "@/lib/local-db/session";
import { localDb } from "@/lib/local-db/db";

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({
  className,
}: LogoutButtonProps) {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  function handleLogout(): void {
    if (pending) {
      return;
    }

    startTransition(
      async () => {
        try {
          await fetch(
            "/api/auth/logout",
            {
              method:
                "POST",

              credentials:
                "same-origin",

              cache:
                "no-store",
            },
          );
        } finally {
          await clearLocalSession().catch(() => undefined);
          await localDb.syncMetadata.delete("localSubscription").catch(() => undefined);
          router.replace(
            "/login",
          );

          router.refresh();
        }
      },
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={
        handleLogout
      }
      className={
        className ??
        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
      }
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}

      Logout
    </button>
  );
}