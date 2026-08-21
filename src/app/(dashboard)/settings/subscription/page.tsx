"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  CheckCircle2,
  Monitor,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

import { getDeviceId } from "@/lib/local-db/device";
import {
  getOfflineLeaseInfo,
} from "@/lib/local-db/session";

interface SubscriptionData {
  id: string;
  plan: string;
  status: string;
  startsAt: string;
  expiresAt: string;
  maxDevices: number;
}

interface DeviceData {
  id: string;
  name: string | null;
  status: string;
  activatedAt: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

interface StatusResponse {
  success?: boolean;
  data?: {
    subscription?: SubscriptionData | null;
    device?: DeviceData | null;
  };
  error?: string;
}

function formatDate(
  value: string | null | undefined,
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

function daysRemaining(
  expiresAt: string | null | undefined,
): number | null {
  if (!expiresAt) return null;

  const ms =
    new Date(expiresAt).getTime() -
    Date.now();

  return Math.max(
    0,
    Math.ceil(
      ms / 86400000,
    ),
  );
}

export default function SubscriptionSettingsPage() {
  const [
    subscription,
    setSubscription,
  ] =
    useState<SubscriptionData | null>(
      null,
    );

  const [device, setDevice] =
    useState<DeviceData | null>(
      null,
    );

  const [
    offlineLease,
    setOfflineLease,
  ] = useState<Awaited<
    ReturnType<
      typeof getOfflineLeaseInfo
    >
  > | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState<string | null>(null);

  const loadStatus =
    useCallback(
      async () => {
        setLoading(true);
        setMessage(null);

        try {
          const deviceKey =
            await getDeviceId();

          const response =
            await fetch(
              "/api/device/status",
              {
                headers: {
                  "x-device-key":
                    deviceKey,
                },
                credentials:
                  "include",
                cache:
                  "no-store",
              },
            );

          const body =
            (await response.json()) as StatusResponse;

          if (
            !response.ok ||
            !body.success
          ) {
            throw new Error(
              body.error ??
                "Unable to load subscription details.",
            );
          }

          setDevice(
            body.data?.device ??
              null,
          );

          setSubscription(
            body.data?.subscription ??
              null,
          );

          setOfflineLease(
            await getOfflineLeaseInfo(),
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load subscription details.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  // Load data on mount - using an async IIFE pattern
  useEffect(() => {
    const fetchData = async () => {
      await loadStatus();
    };
    fetchData();
  }, [loadStatus]);

  const remaining =
    daysRemaining(
      subscription?.expiresAt,
    );

  const isActivated =
    device?.status === "ACTIVE";

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">
              Subscription & Device
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Activation Center
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Subscription activation is completed
              during login. This page is now a
              read-only status center for the active
              subscription, bound device and offline
              validation lease.
            </p>
          </div>

          <button
            onClick={() =>
              loadStatus()
            }
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading
                  ? "animate-spin"
                  : ""
              }`}
            />
            Refresh
          </button>
        </div>
      </header>

      {message && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {message}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-xl font-semibold">
                Subscription
              </h2>
              <p className="text-sm text-muted-foreground">
                Current paid access.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoCard
              label="Plan"
              value={
                subscription?.plan ??
                "—"
              }
            />
            <InfoCard
              label="Status"
              value={
                subscription?.status ??
                "—"
              }
            />
            <InfoCard
              label="Expires"
              value={formatDate(
                subscription?.expiresAt,
              )}
            />
            <InfoCard
              label="Remaining"
              value={
                remaining === null
                  ? "—"
                  : `${remaining} days`
              }
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Monitor className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-xl font-semibold">
                Bound Device
              </h2>
              <p className="text-sm text-muted-foreground">
                The POS device authorized to sync.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoCard
              label="Name"
              value={
                device?.name ??
                "This Computer"
              }
            />
            <InfoCard
              label="Status"
              value={
                device?.status ??
                "—"
              }
            />
            <InfoCard
              label="Activated"
              value={formatDate(
                device?.activatedAt,
              )}
            />
            <InfoCard
              label="Last Seen"
              value={formatDate(
                device?.lastSeenAt,
              )}
            />
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border bg-muted/40 p-3 text-xs">
            {isActivated ? (
              <CheckCircle2 className="size-4 text-primary" />
            ) : (
              <WifiOff className="size-4 text-muted-foreground" />
            )}

            <span className="text-muted-foreground">
              {isActivated
                ? "This device is active and bound to the restaurant."
                : "This device is not currently active."}
            </span>
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <WifiOff className="size-5 text-primary" />
          <div>
            <h2 className="font-semibold">
              Offline validation lease
            </h2>
            <p className="text-sm text-muted-foreground">
              3 days normal offline access + 1 final
              warning/grace day.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <InfoCard
            label="Last validation"
            value={formatDate(
              offlineLease?.lastValidatedAt,
            )}
          />
          <InfoCard
            label="Warning starts"
            value={formatDate(
              offlineLease?.offlineWarningAt,
            )}
          />
          <InfoCard
            label="Hard stop"
            value={formatDate(
              offlineLease?.offlineGraceUntil,
            )}
          />
        </div>
      </section>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-semibold">
        {value}
      </p>
    </div>
  );
}