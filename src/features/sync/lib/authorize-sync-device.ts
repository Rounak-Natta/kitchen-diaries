import {
  DeviceStatus,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

export interface AuthorizedSyncDevice {
  id: string;
  restaurantId: string;
}

interface AuthorizeSyncDeviceInput {
  deviceId: string;
  restaurantId: string;
}

export async function authorizeSyncDevice(
  input: AuthorizeSyncDeviceInput,
): Promise<AuthorizedSyncDevice | null> {
  const deviceId =
    input.deviceId.trim();

  const restaurantId =
    input.restaurantId.trim();

  if (
    !deviceId ||
    !restaurantId
  ) {
    return null;
  }

  const device =
    await prisma.device.findUnique({
      where: {
        id: deviceId,
      },

      select: {
        id: true,
        restaurantId: true,
        status: true,
      },
    });

  if (!device) {
    return null;
  }

  if (
    device.status !==
    DeviceStatus.ACTIVE
  ) {
    return null;
  }

  if (
    device.restaurantId !==
    restaurantId
  ) {
    return null;
  }

  return {
    id: device.id,

    restaurantId:
      device.restaurantId,
  };
}