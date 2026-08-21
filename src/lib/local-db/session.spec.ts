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
  clearLocalSession,
  getLocalSession,
  saveLocalSession,
  type LocalSession,
} from "./session";

const testSession: LocalSession = {
  userId: "user-1",
  restaurantId: "restaurant-1",

  name: "Test User",
  email: "test@example.com",
  role: "OWNER",

  deviceId: "device-1",

  authenticatedAt:
    "2026-08-13T10:00:00.000Z",

  expiresAt:
    "2099-08-14T10:00:00.000Z",
};

describe(
  "local session",
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
      "stores and retrieves a local session",
      async () => {
        await saveLocalSession(
          testSession,
        );

        const session =
          await getLocalSession();

        expect(
          session,
        ).toEqual(
          testSession,
        );
      },
    );

    it(
      "returns null when no session exists",
      async () => {
        const session =
          await getLocalSession();

        expect(
          session,
        ).toBeNull();
      },
    );

    it(
      "clears the local session",
      async () => {
        await saveLocalSession(
          testSession,
        );

        await clearLocalSession();

        const session =
          await getLocalSession();

        expect(
          session,
        ).toBeNull();
      },
    );
  },
);