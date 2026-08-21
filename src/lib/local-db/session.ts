import { getOfflineAccessStatus } from "@/lib/auth/offline-lease";

import { localDb } from "./db";

export interface LocalSession {
  userId: string;
  restaurantId: string;

  name: string;
  email: string;
  role: string;

  /**
   * Server-side device id. Offline operations use this id
   * when they are queued and later synchronized.
   */
  deviceId: string;

  authenticatedAt: string;

  /**
   * Kept for backward compatibility with the existing local
   * database. It now represents the offline hard-stop time.
   */
  expiresAt: string;

  lastValidatedAt?: string;
  offlineWarningAt?: string;
  offlineGraceUntil?: string;
}

export type LocalOfflineAccessState =
  | "NONE"
  | "ACTIVE"
  | "WARNING"
  | "BLOCKED";

const SESSION_KEY = "localSession";

async function readStoredSession(): Promise<
  LocalSession | null
> {
  const record =
    await localDb.syncMetadata.get(
      SESSION_KEY,
    );

  if (!record) {
    return null;
  }

  try {
    const session =
      JSON.parse(
        record.value,
      ) as LocalSession;

    if (
      !session.userId ||
      !session.restaurantId ||
      !session.deviceId ||
      !session.expiresAt
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function saveLocalSession(
  session: LocalSession,
): Promise<void> {
  await localDb.syncMetadata.put({
    key: SESSION_KEY,
    value: JSON.stringify(session),
  });
}

export async function getStoredLocalSession(): Promise<
  LocalSession | null
> {
  return readStoredSession();
}

export async function getLocalSession(): Promise<
  LocalSession | null
> {
  const session =
    await readStoredSession();

  if (!session) {
    return null;
  }

  const expiresAt =
    Date.parse(session.expiresAt);

  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    return null;
  }

  return session;
}

export async function getLocalOfflineAccessState(
  now = new Date(),
): Promise<LocalOfflineAccessState> {
  const session =
    await readStoredSession();

  if (!session) {
    return "NONE";
  }

  if (
    session.offlineWarningAt &&
    session.offlineGraceUntil
  ) {
    const status =
      getOfflineAccessStatus(
        {
          offlineWarningAt:
            session.offlineWarningAt,
          offlineGraceUntil:
            session.offlineGraceUntil,
        },
        now,
      );

    return status;
  }

  const expiresAt =
    Date.parse(session.expiresAt);

  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= now.getTime()
  ) {
    return "BLOCKED";
  }

  return "ACTIVE";
}

export async function getOfflineLeaseInfo(): Promise<{
  lastValidatedAt: string | null;
  offlineWarningAt: string | null;
  offlineGraceUntil: string | null;
  status: LocalOfflineAccessState;
}> {
  const session =
    await readStoredSession();

  if (!session) {
    return {
      lastValidatedAt: null,
      offlineWarningAt: null,
      offlineGraceUntil: null,
      status: "NONE",
    };
  }

  return {
    lastValidatedAt:
      session.lastValidatedAt ??
      null,
    offlineWarningAt:
      session.offlineWarningAt ??
      null,
    offlineGraceUntil:
      session.offlineGraceUntil ??
      null,
    status:
      await getLocalOfflineAccessState(),
  };
}

export async function clearLocalSession(): Promise<void> {
  await localDb.syncMetadata.delete(
    SESSION_KEY,
  );
}
