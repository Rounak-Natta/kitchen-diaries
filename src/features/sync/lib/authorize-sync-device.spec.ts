import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  DeviceStatus,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

import {
  authorizeSyncDevice,
} from "./authorize-sync-device";

vi.mock(
  "@/lib/prisma",
  () => ({
    prisma: {
      device: {
        findUnique:
          vi.fn(),
      },
    },
  }),
);

describe(
  "authorize sync device",
  () => {
    beforeEach(
      () => {
        vi.clearAllMocks();
      },
    );

    it(
      "authorizes an active device belonging to the restaurant",
      async () => {
        vi.mocked(
          prisma.device.findUnique,
        ).mockResolvedValue({
          id: "device-1",

          restaurantId:
            "restaurant-1",

          status:
            DeviceStatus.ACTIVE,
        } as never);

        const result =
          await authorizeSyncDevice({
            deviceId:
              "device-1",

            restaurantId:
              "restaurant-1",
          });

        expect(
          result,
        ).toEqual({
          id: "device-1",

          restaurantId:
            "restaurant-1",
        });
      },
    );

    it(
      "rejects an unknown device",
      async () => {
        vi.mocked(
          prisma.device.findUnique,
        ).mockResolvedValue(
          null,
        );

        const result =
          await authorizeSyncDevice({
            deviceId:
              "unknown-device",

            restaurantId:
              "restaurant-1",
          });

        expect(
          result,
        ).toBeNull();
      },
    );

    it(
      "rejects an inactive device",
      async () => {
        vi.mocked(
          prisma.device.findUnique,
        ).mockResolvedValue({
          id: "device-1",

          restaurantId:
            "restaurant-1",

          status:
            DeviceStatus.REVOKED,
        } as never);

        const result =
          await authorizeSyncDevice({
            deviceId:
              "device-1",

            restaurantId:
              "restaurant-1",
          });

        expect(
          result,
        ).toBeNull();
      },
    );

    it(
      "rejects a device belonging to another restaurant",
      async () => {
        vi.mocked(
          prisma.device.findUnique,
        ).mockResolvedValue({
          id: "device-1",

          restaurantId:
            "restaurant-2",

          status:
            DeviceStatus.ACTIVE,
        } as never);

        const result =
          await authorizeSyncDevice({
            deviceId:
              "device-1",

            restaurantId:
              "restaurant-1",
          });

        expect(
          result,
        ).toBeNull();
      },
    );
  },
);