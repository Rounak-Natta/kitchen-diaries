import {
  Role,
} from "@prisma/client";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  comparePassword,
  createOfflineLease,
  generateToken,
  getOfflineAccessStatus,
  hashPassword,
  verifyToken,
  type AuthUser,
} from "./auth";

const TEST_USER: AuthUser = {
  id: "test-user-id",
  restaurantId:
    "test-restaurant-id",
  name: "Test Owner",
  email:
    "owner@example.com",
  role: Role.OWNER,
};

describe(
  "authentication helpers",
  () => {
    it(
      "hashes and verifies a valid password",
      async () => {
        const password =
          "StrongPassword123";

        const hash =
          await hashPassword(
            password,
          );

        expect(hash).not.toBe(
          password,
        );

        await expect(
          comparePassword(
            password,
            hash,
          ),
        ).resolves.toBe(true);
      },
    );

    it(
      "rejects an incorrect password",
      async () => {
        const hash =
          await hashPassword(
            "StrongPassword123",
          );

        await expect(
          comparePassword(
            "IncorrectPassword123",
            hash,
          ),
        ).resolves.toBe(false);
      },
    );

    it(
      "generates and verifies a JWT",
      () => {
        const token =
          generateToken(
            TEST_USER,
          );

        const decoded =
          verifyToken(token);

        expect(decoded).toMatchObject(
          TEST_USER,
        );
      },
    );



    it("creates a 3-day warning and 4-day hard-stop offline lease", () => {
      const validatedAt = new Date("2026-08-19T00:00:00.000Z");
      const lease = createOfflineLease(validatedAt);

      expect(lease.offlineWarningAt).toBe("2026-08-22T00:00:00.000Z");
      expect(lease.offlineGraceUntil).toBe("2026-08-23T00:00:00.000Z");

      expect(
        getOfflineAccessStatus(lease, new Date("2026-08-21T23:59:59.000Z")),
      ).toBe("ACTIVE");

      expect(
        getOfflineAccessStatus(lease, new Date("2026-08-22T12:00:00.000Z")),
      ).toBe("WARNING");

      expect(
        getOfflineAccessStatus(lease, new Date("2026-08-23T00:00:00.000Z")),
      ).toBe("BLOCKED");
    });

    it(
      "rejects an invalid JWT",
      () => {
        vi
          .spyOn(
            console,
            "error",
          )
          .mockImplementation(
            () => undefined,
          );

        expect(
          verifyToken(
            "invalid-token",
          ),
        ).toBeNull();
      },
    );
  },
);