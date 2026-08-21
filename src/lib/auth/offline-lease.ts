/**
 * Pure client/server-safe offline lease helpers.
 * Do not import Node-only auth dependencies here.
 */

export const OFFLINE_WARNING_SECONDS =
  3 * 24 * 60 * 60;

export const OFFLINE_GRACE_SECONDS =
  4 * 24 * 60 * 60;

export const AUTH_SESSION_TTL_SECONDS =
  OFFLINE_GRACE_SECONDS + 60 * 60;

export const AUTH_REVALIDATION_INTERVAL_MS =
  6 * 60 * 60 * 1000;

export interface OfflineLease {
  lastValidatedAt: string;
  offlineWarningAt: string;
  offlineGraceUntil: string;
}

export function createOfflineLease(
  validatedAt = new Date(),
): OfflineLease {
  return {
    lastValidatedAt:
      validatedAt.toISOString(),

    offlineWarningAt:
      new Date(
        validatedAt.getTime() +
          OFFLINE_WARNING_SECONDS * 1000,
      ).toISOString(),

    offlineGraceUntil:
      new Date(
        validatedAt.getTime() +
          OFFLINE_GRACE_SECONDS * 1000,
      ).toISOString(),
  };
}

export type OfflineAccessStatus =
  | "ACTIVE"
  | "WARNING"
  | "BLOCKED";

export function getOfflineAccessStatus(
  lease: Pick<
    OfflineLease,
    "offlineWarningAt" | "offlineGraceUntil"
  >,
  now = new Date(),
): OfflineAccessStatus {
  const warningAt =
    Date.parse(
      lease.offlineWarningAt,
    );

  const graceUntil =
    Date.parse(
      lease.offlineGraceUntil,
    );

  if (
    !Number.isFinite(warningAt) ||
    !Number.isFinite(graceUntil)
  ) {
    return "BLOCKED";
  }

  if (
    now.getTime() >=
    graceUntil
  ) {
    return "BLOCKED";
  }

  if (
    now.getTime() >=
    warningAt
  ) {
    return "WARNING";
  }

  return "ACTIVE";
}
