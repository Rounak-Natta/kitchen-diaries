import { localDb } from "./db";

export interface LocalSubscription {
  id?: string;
  plan: string;
  status: string;
  startsAt: string;
  expiresAt: string;
  maxDevices?: number;

  /**
   * These fields describe the authentication validation
   * lease, not an extension of the paid subscription itself.
   */
  lastValidatedAt?: string;
  offlineWarningAt?: string;
  offlineGraceUntil?: string;
}

const KEY = "localSubscription";

export async function saveLocalSubscription(
  subscription: LocalSubscription,
): Promise<void> {
  await localDb.syncMetadata.put({
    key: KEY,
    value: JSON.stringify(subscription),
  });
}

export async function getLocalSubscription(): Promise<
  LocalSubscription | null
> {
  const record =
    await localDb.syncMetadata.get(KEY);

  if (!record) {
    return null;
  }

  try {
    return JSON.parse(
      record.value,
    ) as LocalSubscription;
  } catch {
    return null;
  }
}

export async function isLocalSubscriptionValid(
  now = new Date(),
): Promise<boolean> {
  const subscription =
    await getLocalSubscription();

  if (
    !subscription ||
    subscription.status !== "ACTIVE"
  ) {
    return false;
  }

  const expiresAt =
    Date.parse(subscription.expiresAt);

  return (
    Number.isFinite(expiresAt) &&
    now.getTime() < expiresAt
  );
}
