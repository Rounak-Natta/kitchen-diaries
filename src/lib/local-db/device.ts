import {
  localDb,
} from "./db";

const DEVICE_ID_KEY =
  "deviceId";

export async function getDeviceId(): Promise<string> {
  const existing =
    await localDb.syncMetadata.get(
      DEVICE_ID_KEY,
    );

  if (existing?.value) {
    return existing.value;
  }

  const deviceId =
    crypto.randomUUID();

  await localDb.syncMetadata.put({
    key: DEVICE_ID_KEY,
    value: deviceId,
  });

  return deviceId;
}