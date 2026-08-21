"use client";

import {
  AUTH_REVALIDATION_INTERVAL_MS,
} from "@/lib/auth/offline-lease";

import { getDeviceId } from "./device";
import { runLocalMigrations } from "./migrations";
import {
  getLocalSession,
  saveLocalSession,
} from "./session";
import {
  saveLocalSubscription,
} from "./subscription";
import {
  syncEngine,
  initializeSyncEngineListeners,
} from "./sync-engine";

let initialized = false;

interface ValidationResponse {
  success?: boolean;
  user?: {
    id: string;
    restaurantId: string;
    name: string;
    email: string;
    role: string;
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
    name?: string | null;
    status: string;
    activatedAt?: string | null;
  };
  offlineLease?: {
    lastValidatedAt: string;
    offlineWarningAt: string;
    offlineGraceUntil: string;
  };
}

async function persistValidatedSession(
  body: ValidationResponse,
): Promise<boolean> {
  const user = body.user;

  if (
    !body.success ||
    !user ||
    !body.device ||
    !body.subscription ||
    !body.offlineLease
  ) {
    return false;
  }

  await saveLocalSubscription({
    id: body.subscription.id,
    plan: body.subscription.plan,
    status: body.subscription.status,
    startsAt: body.subscription.startsAt,
    expiresAt: body.subscription.expiresAt,
    maxDevices:
      body.subscription.maxDevices,
    lastValidatedAt:
      body.offlineLease.lastValidatedAt,
    offlineWarningAt:
      body.offlineLease.offlineWarningAt,
    offlineGraceUntil:
      body.offlineLease.offlineGraceUntil,
  });

  await saveLocalSession({
    userId: user.id,
    restaurantId:
      user.restaurantId,
    name: user.name,
    email: user.email,
    role: user.role,
    deviceId: body.device.id,
    authenticatedAt:
      body.offlineLease.lastValidatedAt,
    expiresAt:
      body.offlineLease.offlineGraceUntil,
    lastValidatedAt:
      body.offlineLease.lastValidatedAt,
    offlineWarningAt:
      body.offlineLease.offlineWarningAt,
    offlineGraceUntil:
      body.offlineLease.offlineGraceUntil,
  });

  return true;
}

export async function validateOnlineSession(
  force = false,
): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !navigator.onLine
  ) {
    return false;
  }

  const localSession =
    await getLocalSession();

  if (
    !force &&
    localSession?.lastValidatedAt
  ) {
    const age =
      Date.now() -
      Date.parse(
        localSession.lastValidatedAt,
      );

    if (
      Number.isFinite(age) &&
      age >= 0 &&
      age <
        AUTH_REVALIDATION_INTERVAL_MS
    ) {
      return true;
    }
  }

  try {
    const deviceKey =
      await getDeviceId();

    const response =
      await fetch(
        "/api/auth/validate",
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            accept:
              "application/json",
            "x-device-key":
              deviceKey,
            ...(localSession?.deviceId
              ? {
                  "x-device-id":
                    localSession.deviceId,
                }
              : {}),
          },
        },
      );

    if (!response.ok) {
      return false;
    }

    const body =
      (await response.json()) as ValidationResponse;

    return persistValidatedSession(
      body,
    );
  } catch {
    return false;
  }
}

async function hydrateLocalSession(): Promise<void> {
  /*
   * Online validation is the only place where the offline
   * lease is renewed. If it fails, the existing local lease
   * is intentionally preserved.
   */
  await validateOnlineSession();
}

export async function initializeSync(): Promise<void> {
  if (initialized) {
    return;
  }

  initialized = true;

  initializeSyncEngineListeners();

  await runLocalMigrations();

  await hydrateLocalSession();

  await syncEngine.initialize();

  void syncEngine.sync().catch(
    () => undefined,
  );
}

export async function runSync(): Promise<void> {
  if (
    typeof window !== "undefined" &&
    navigator.onLine
  ) {
    await validateOnlineSession();
  }

  await syncEngine.sync();
}

export function isSyncInitialized(): boolean {
  return initialized;
}
