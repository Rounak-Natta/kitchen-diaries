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
  clearSyncCursor,
  getSyncCursor,
  saveSyncCursor,
} from "./cursor";

describe(
  "sync cursor",
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
      "returns null when no cursor exists",
      async () => {
        const cursor =
          await getSyncCursor();

        expect(
          cursor,
        ).toBeNull();
      },
    );

    it(
      "saves and retrieves a cursor",
      async () => {
        await saveSyncCursor(
          "cursor-123",
        );

        const cursor =
          await getSyncCursor();

        expect(
          cursor,
        ).toBe(
          "cursor-123",
        );
      },
    );

    it(
      "updates an existing cursor",
      async () => {
        await saveSyncCursor(
          "cursor-1",
        );

        await saveSyncCursor(
          "cursor-2",
        );

        const cursor =
          await getSyncCursor();

        expect(
          cursor,
        ).toBe(
          "cursor-2",
        );
      },
    );

    it(
      "clears the cursor",
      async () => {
        await saveSyncCursor(
          "cursor-123",
        );

        await clearSyncCursor();

        const cursor =
          await getSyncCursor();

        expect(
          cursor,
        ).toBeNull();
      },
    );
  },
);