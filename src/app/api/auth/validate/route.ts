import { NextResponse } from "next/server";

import {
  createOfflineLease,
  generateToken,
  type AuthUser,
} from "@/lib/auth";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
} from "@/lib/auth-cookie";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
): Promise<Response> {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
          code: "AUTH_REQUIRED",
        },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        },
      );
    }

    const deviceKey =
      request.headers
        .get("x-device-key")
        ?.trim();

    const deviceId =
      request.headers
        .get("x-device-id")
        ?.trim();

    const crypto = await import("node:crypto");
    const deviceKeyHash = deviceKey
      ? crypto.createHash("sha256").update(deviceKey, "utf8").digest("hex")
      : null;

    let resolvedDevice = null;

    if (deviceId && deviceKeyHash) {
      resolvedDevice = await prisma.device.findFirst({
        where: {
          id: deviceId,
          restaurantId: user.restaurantId,
          deviceKeyHash,
          status: "ACTIVE",
        },
        select: { id: true, name: true, status: true, activatedAt: true },
      });
    } else if (deviceId) {
      resolvedDevice = await prisma.device.findFirst({
        where: { id: deviceId, restaurantId: user.restaurantId, status: "ACTIVE" },
        select: { id: true, name: true, status: true, activatedAt: true },
      });
    } else if (deviceKeyHash) {
      resolvedDevice = await prisma.device.findFirst({
        where: { deviceKeyHash, restaurantId: user.restaurantId, status: "ACTIVE" },
        select: { id: true, name: true, status: true, activatedAt: true },
      });
    }

    if (!resolvedDevice) {
      return NextResponse.json(
        { success: false, error: "This device is not active or the device credentials do not match.", code: "DEVICE_INACTIVE" },
        { status: 403, headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    const subscription =
      await prisma.subscription.findFirst({
        where: {
          restaurantId:
            user.restaurantId,
          status: "ACTIVE",
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          expiresAt: "desc",
        },
        select: {
          id: true,
          plan: true,
          status: true,
          startsAt: true,
          expiresAt: true,
          maxDevices: true,
        },
      });

    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The restaurant subscription is expired or inactive.",
          code: "SUBSCRIPTION_INVALID",
        },
        { status: 403 },
      );
    }

    const validatedAt = new Date();
    const offlineLease =
      createOfflineLease(validatedAt);

    await prisma.device.update({
      where: {
        id: resolvedDevice.id,
      },
      data: {
        lastSeenAt: validatedAt,
      },
    });

    const authUser: AuthUser = {
      id: user.id,
      restaurantId:
        user.restaurantId,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token =
      generateToken(
        authUser,
        offlineLease,
      );

    const response =
      NextResponse.json(
        {
          success: true,
          user,
          subscription: {
            ...subscription,
            startsAt:
              subscription.startsAt.toISOString(),
            expiresAt:
              subscription.expiresAt.toISOString(),
          },
          device: {
            ...resolvedDevice,
            activatedAt:
              resolvedDevice.activatedAt
                ?.toISOString() ?? null,
          },
          offlineLease,
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        },
      );

    response.cookies.set(
      AUTH_COOKIE_NAME,
      token,
      getAuthCookieOptions(),
    );

    return response;
  } catch (error) {
    console.error(
      "AUTH_VALIDATE_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Online validation could not be completed.",
        code: "VALIDATION_FAILED",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  }
}
