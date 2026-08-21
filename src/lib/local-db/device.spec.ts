import "fake-indexeddb/auto";

import Dexie from "dexie";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  localDb,
} from "./db";

import {
  getDeviceId,
} from "./device";

describe(
  "local device identity",
  () => {
    beforeEach(
      async () => {
        if (
          localDb.isOpen()
        ) {
          localDb.close();
        }

        await Dexie.delete(
          localDb.name,
        );

        await localDb.open();
      },
    );

    afterEach(
      () => {
        localDb.close();
      },
    );

    it(
      "creates a device ID",
      async () => {
        const deviceId =
          await getDeviceId();

        expect(
          deviceId,
        ).toEqual(
          expect.any(String),
        );

        expect(
          deviceId.length,
        ).toBeGreaterThan(0);
      },
    );

    it(
      "returns the same device ID on subsequent calls",
      async () => {
        const first =
          await getDeviceId();

        const second =
          await getDeviceId();

        expect(
          second,
        ).toBe(first);
      },
    );
  },
);