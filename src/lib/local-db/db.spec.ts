import "fake-indexeddb/auto";

import Dexie from "dexie";

import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  localDb,
} from "./db";

describe(
  "Kitchen Diaries local database",
  () => {
    beforeEach(
      async () => {
        if (localDb.isOpen()) {
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
      "opens successfully",
      () => {
        expect(
          localDb.isOpen(),
        ).toBe(true);
      },
    );

    it(
      "stores sync metadata",
      async () => {
        await localDb.syncMetadata.put({
          key: "deviceId",
          value: "test-device",
        });

        const record =
          await localDb.syncMetadata.get(
            "deviceId",
          );

        expect(record).toEqual({
          key: "deviceId",
          value: "test-device",
        });
      },
    );
  },
);