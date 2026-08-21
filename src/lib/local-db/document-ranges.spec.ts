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
  allocateNextDocumentNumber,
  getAvailableDocumentNumberRange,
  getDocumentNumberRange,
  saveDocumentNumberRange,
} from "./document-ranges";

describe(
  "local document number ranges",
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
      "saves and retrieves a range",
      async () => {
        await saveDocumentNumberRange({
          id: "range-1",

          deviceId:
            "device-1",

          restaurantId:
            "restaurant-1",

          documentType:
            "ORDER",

          businessDate:
            "2026-08-13",

          startValue:
            1001,

          endValue:
            1100,

          nextValue:
            1001,
        });

        const range =
          await getDocumentNumberRange(
            "range-1",
          );

        expect(
          range,
        ).toMatchObject({
          id: "range-1",

          startValue:
            1001,

          endValue:
            1100,

          nextValue:
            1001,
        });
      },
    );

    it(
      "finds an available range",
      async () => {
        await saveDocumentNumberRange({
          id: "range-1",

          deviceId:
            "device-1",

          restaurantId:
            "restaurant-1",

          documentType:
            "ORDER",

          businessDate:
            "2026-08-13",

          startValue:
            1001,

          endValue:
            1100,

          nextValue:
            1001,
        });

        const range =
          await getAvailableDocumentNumberRange(
            "device-1",
            "ORDER",
            "2026-08-13",
          );

        expect(
          range?.id,
        ).toBe(
          "range-1",
        );
      },
    );

    it(
      "allocates numbers sequentially",
      async () => {
        await saveDocumentNumberRange({
          id: "range-1",

          deviceId:
            "device-1",

          restaurantId:
            "restaurant-1",

          documentType:
            "ORDER",

          businessDate:
            "2026-08-13",

          startValue:
            1001,

          endValue:
            1003,

          nextValue:
            1001,
        });

        const first =
          await allocateNextDocumentNumber(
            "device-1",
            "ORDER",
            "2026-08-13",
          );

        const second =
          await allocateNextDocumentNumber(
            "device-1",
            "ORDER",
            "2026-08-13",
          );

        const third =
          await allocateNextDocumentNumber(
            "device-1",
            "ORDER",
            "2026-08-13",
          );

        expect(first).toBe(
          1001,
        );

        expect(second).toBe(
          1002,
        );

        expect(third).toBe(
          1003,
        );
      },
    );

    it(
      "returns null when the range is exhausted",
      async () => {
        await saveDocumentNumberRange({
          id: "range-1",

          deviceId:
            "device-1",

          restaurantId:
            "restaurant-1",

          documentType:
            "ORDER",

          businessDate:
            "2026-08-13",

          startValue:
            1001,

          endValue:
            1001,

          nextValue:
            1001,
        });

        const first =
          await allocateNextDocumentNumber(
            "device-1",
            "ORDER",
            "2026-08-13",
          );

        const second =
          await allocateNextDocumentNumber(
            "device-1",
            "ORDER",
            "2026-08-13",
          );

        expect(first).toBe(
          1001,
        );

        expect(second).toBeNull();
      },
    );
  },
);