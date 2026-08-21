"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  Loader2,
  LockKeyhole,
  WifiOff,
} from "lucide-react";
import {
  useRouter,
} from "next/navigation";

import {
  getLocalOfflineAccessState,
  getLocalSession,
} from "@/lib/local-db/session";
import { validateOnlineSession } from "@/lib/local-db/sync-bootstrap";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

type GateState =
  | "LOADING"
  | "READY"
  | "LOGIN_REQUIRED"
  | "FORBIDDEN"
  | "OFFLINE_BLOCKED";

export function PosAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] =
    useState<GateState>(
      "LOADING",
    );

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      let session =
        await getLocalSession();

      if (!session && navigator.onLine) {
        await validateOnlineSession(true).catch(
          () => false,
        );
        session =
          await getLocalSession();
      }

      if (session) {
        if (
          !hasPermission(
            session.role,
            PERMISSIONS.ORDERS_CREATE,
          )
        ) {
          if (!cancelled) {
            setState("FORBIDDEN");
          }
          return;
        }

        if (!cancelled) {
          setState("READY");
        }
        return;
      }

      if (navigator.onLine) {
        if (!cancelled) {
          setState("LOGIN_REQUIRED");
        }
        router.replace("/login");
        return;
      }

      const offlineState =
        await getLocalOfflineAccessState();

      if (!cancelled) {
        setState(
          offlineState === "ACTIVE" ||
            offlineState === "WARNING"
            ? "READY"
            : "OFFLINE_BLOCKED",
        );
      }
    };

    void check();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "READY") {
    return <>{children}</>;
  }

  if (state === "LOADING") {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-muted/20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          Preparing POS…
        </div>
      </main>
    );
  }

  if (state === "LOGIN_REQUIRED") {
    return null;
  }

  if (state === "FORBIDDEN") {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-muted/20 p-6">
        <section className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-lg">
          <LockKeyhole className="mx-auto size-8 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">
            POS access denied
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your restaurant role does not have
            permission to create orders.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-muted/20 p-6">
      <section className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-lg">
        <WifiOff className="mx-auto size-8 text-destructive" />
        <h1 className="mt-4 text-xl font-semibold">
          POS is locked offline
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect to the internet and sign in to
          establish a valid offline lease before
          using this POS.
        </p>
      </section>
    </main>
  );
}
