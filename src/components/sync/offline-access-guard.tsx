"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  AlertTriangle,
  Cloud,
  LockKeyhole,
} from "lucide-react";

import {
  getLocalOfflineAccessState,
  getOfflineLeaseInfo,
} from "@/lib/local-db/session";
import {
  isLocalSubscriptionValid,
} from "@/lib/local-db/subscription";

type AccessState =
  | "LOADING"
  | "ACTIVE"
  | "WARNING"
  | "BLOCKED";

function formatTimeLeft(
  target: string | null,
): string {
  if (!target) {
    return "unknown";
  }

  const remaining =
    Date.parse(target) -
    Date.now();

  if (remaining <= 0) {
    return "now";
  }

  const hours = Math.ceil(
    remaining /
      (60 * 60 * 1000),
  );

  if (hours < 24) {
    return `${hours}h`;
  }

  return `${Math.ceil(
    hours / 24,
  )} days`;
}

export function OfflineAccessGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const [online, setOnline] =
    useState(
      typeof navigator ===
        "undefined"
        ? true
        : navigator.onLine,
    );

  const [state, setState] =
    useState<AccessState>(
      "LOADING",
    );

  const [leaseEnd, setLeaseEnd] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    const update = () => {
      setOnline(
        navigator.onLine,
      );
    };

    window.addEventListener(
      "online",
      update,
    );
    window.addEventListener(
      "offline",
      update,
    );

    return () => {
      window.removeEventListener(
        "online",
        update,
      );
      window.removeEventListener(
        "offline",
        update,
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (online) {
        /*
         * Online access is governed by the server JWT/RBAC.
         * The local lease is only an offline fallback.
         */
        if (!cancelled) {
          setState("ACTIVE");
        }
        return;
      }

      const [
        localState,
        subscriptionValid,
        lease,
      ] = await Promise.all([
        getLocalOfflineAccessState(),
        isLocalSubscriptionValid(),
        getOfflineLeaseInfo(),
      ]);

      if (cancelled) {
        return;
      }

      setLeaseEnd(
        lease.offlineGraceUntil,
      );

      if (
        !subscriptionValid ||
        localState === "BLOCKED" ||
        localState === "NONE"
      ) {
        setState("BLOCKED");
        return;
      }

      setState(
        localState === "WARNING"
          ? "WARNING"
          : "ACTIVE",
      );
    };

    void check();

    const interval =
      window.setInterval(
        () => void check(),
        30_000,
      );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [online]);

  if (
    online ||
    state === "LOADING" ||
    state === "ACTIVE" ||
    state === "WARNING"
  ) {
    return (
      <>
        {state === "WARNING" &&
          !online && (
            <OfflineWarning
              leaseEnd={leaseEnd}
            />
          )}
        {children}
      </>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-lg rounded-3xl border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <LockKeyhole className="size-7" />
        </div>

        <h1 className="text-2xl font-bold">
          Offline access paused
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Kitchen Diaries could not validate this
          device online within the allowed offline
          window. Connect this POS to the internet
          and sign in again to restore access.
        </p>

        <div className="mt-6 rounded-2xl border bg-muted/30 p-4 text-left text-sm">
          <div className="flex items-start gap-3">
            <Cloud className="mt-0.5 size-4 text-primary" />
            <div>
              <p className="font-medium">
                Your local data is still preserved.
              </p>
              <p className="mt-1 text-muted-foreground">
                Do not clear browser/app storage.
                Reconnect first so pending changes
                can synchronize.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            window.location.reload()
          }
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
        >
          Retry validation
        </button>
      </section>
    </main>
  );
}

function OfflineWarning({
  leaseEnd,
}: {
  leaseEnd: string | null;
}) {
  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center border-b bg-amber-50 px-4 py-2 text-amber-950 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium">
        <AlertTriangle className="size-4" />
        <span>
          Internet validation is overdue. Reconnect
          within {formatTimeLeft(leaseEnd)} to keep
          Kitchen Diaries running.
        </span>
      </div>
    </div>
  );
}
