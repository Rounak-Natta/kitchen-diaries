"use client";

import {
  Loader2,
  LockKeyhole,
  KeyRound,
  WifiOff,
} from "lucide-react";
import {
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from "react";

import {
  getDeviceId,
} from "@/lib/local-db/device";
import {
  getLocalOfflineAccessState,
  getLocalSession,
  saveLocalSession,
} from "@/lib/local-db/session";
import {
  saveLocalSubscription,
} from "@/lib/local-db/subscription";

interface LoginResponse {
  success: boolean;
  error?: string;
  code?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    restaurantId: string;
  };
  subscription?: {
    id: string;
    plan: string;
    status: string;
    startsAt: string;
    expiresAt: string;
    maxDevices: number;
  };
  device?: {
    id: string;
    name: string | null;
    status: string;
    activatedAt: string | null;
  };
  offlineLease?: {
    lastValidatedAt: string;
    offlineWarningAt: string;
    offlineGraceUntil: string;
  };
}

export default function LoginPage() {
  const router = useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [name, setName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    activationCode,
    setActivationCode,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [offlineSession, setOfflineSession] =
    useState(false);

  useEffect(() => {
    void (async () => {
      if (navigator.onLine) {
        return;
      }

      const session =
        await getLocalSession();

      const state =
        await getLocalOfflineAccessState();

      if (
        session &&
        (state === "ACTIVE" ||
          state === "WARNING")
      ) {
        setOfflineSession(true);
        setEmail(session.email);
      }
    })();
  }, []);

  async function continueOffline(): Promise<void> {
    const session =
      await getLocalSession();

    const state =
      await getLocalOfflineAccessState();

    if (
      !session ||
      (state !== "ACTIVE" &&
        state !== "WARNING")
    ) {
      setErrorMessage(
        "Offline access is no longer valid. Connect to the internet and validate this device.",
      );
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    if (pending) {
      return;
    }

    setErrorMessage(null);

    startTransition(
      async () => {
        try {
          const deviceKey =
            await getDeviceId();

          const response =
            await fetch(
              "/api/auth/login",
              {
                method: "POST",
                cache: "no-store",
                credentials:
                  "same-origin",
                headers: {
                  "Content-Type":
                    "application/json",
                  Accept:
                    "application/json",
                },
                body: JSON.stringify({
                  name,
                  restaurantName,
                  email,
                  password,
                  activationCode,
                  deviceKey,
                }),
              },
            );

          const result =
            (await response
              .json()
              .catch(() => null)) as
              | LoginResponse
              | null;

          if (
            !response.ok ||
            !result?.success
          ) {
            setErrorMessage(
              result?.error ??
                "Unable to sign in.",
            );
            return;
          }

          if (
            !result.user ||
            !result.subscription ||
            !result.device ||
            !result.offlineLease
          ) {
            setErrorMessage(
              "Login succeeded but the device session could not be initialized.",
            );
            return;
          }

          await saveLocalSubscription({
            id:
              result.subscription.id,
            plan:
              result.subscription.plan,
            status:
              result.subscription.status,
            startsAt:
              result.subscription.startsAt,
            expiresAt:
              result.subscription.expiresAt,
            maxDevices:
              result.subscription.maxDevices,
            lastValidatedAt:
              result.offlineLease
                .lastValidatedAt,
            offlineWarningAt:
              result.offlineLease
                .offlineWarningAt,
            offlineGraceUntil:
              result.offlineLease
                .offlineGraceUntil,
          });

          await saveLocalSession({
            userId:
              result.user.id,
            restaurantId:
              result.user.restaurantId,
            name:
              result.user.name,
            email:
              result.user.email,
            role:
              result.user.role,
            deviceId:
              result.device.id,
            authenticatedAt:
              result.offlineLease
                .lastValidatedAt,
            expiresAt:
              result.offlineLease
                .offlineGraceUntil,
            lastValidatedAt:
              result.offlineLease
                .lastValidatedAt,
            offlineWarningAt:
              result.offlineLease
                .offlineWarningAt,
            offlineGraceUntil:
              result.offlineLease
                .offlineGraceUntil,
          });

          router.replace(
            "/dashboard",
          );
          router.refresh();
        } catch {
          setErrorMessage(
            "Unable to connect to Kitchen Diaries. If this device was already activated, you can continue offline while your offline lease is valid.",
          );
        }
      },
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg md:p-8">
        <div className="mb-7">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LockKeyhole className="h-6 w-6" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            Kitchen Diaries
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Sign in and activate this POS
            device.
          </p>
        </div>

        {offlineSession && (
          <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <WifiOff className="mt-0.5 size-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  Offline mode available
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This device has a valid offline
                  session. Internet is not required
                  to continue working.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void continueOffline()
                  }
                  className="mt-3 inline-flex h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
                >
                  Continue Offline
                </button>
              </div>
            </div>
          </div>
        )}

        <form
          method="post"
          action="/api/auth/login"
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {activationCode && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="text-sm font-medium">Owner name</label>
                <input id="name" name="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} disabled={pending} className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60" placeholder="Your name" />
              </div>
              <div>
                <label htmlFor="restaurantName" className="text-sm font-medium">Restaurant name</label>
                <input id="restaurantName" name="restaurantName" value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} maxLength={120} disabled={pending} className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60" placeholder="Your restaurant" />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="text-sm font-medium"
            >
              Email Address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              value={email}
              required
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              disabled={pending}
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={password}
              required
              autoComplete="current-password"
              maxLength={72}
              disabled={pending}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="activationCode"
              className="flex items-center gap-2 text-sm font-medium"
            >
              <KeyRound className="size-4" />
              Subscription / Activation Code
            </label>

            <input
              id="activationCode"
              name="activationCode"
              type="text"
              value={activationCode}
              autoComplete="off"
              maxLength={64}
              disabled={pending}
              onChange={(event) =>
                setActivationCode(
                  event.target.value.toUpperCase(),
                )
              }
              placeholder="KD-XXXX-XXXX-XXXX"
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 font-mono text-sm uppercase outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <p className="mt-1.5 text-xs text-muted-foreground">
              Existing customers can leave this blank. New customers enter the code to create and activate their restaurant on this device.
            </p>
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            {pending
              ? "Validating…"
              : activationCode
                ? "Activate & Sign In"
                : "Sign In & Validate"}
          </button>
        </form>
      </section>
    </main>
  );
}
