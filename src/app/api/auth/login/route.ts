import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { loginSchema } from "@/features/auth/validations/login-schema";
import { comparePassword, createOfflineLease, generateToken, type AuthUser } from "@/lib/auth";
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from "@/lib/auth-cookie";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { activateExistingCustomer, createCustomerFromActivation } from "@/lib/subscription/restaurant-activation";
import { withSerializableTransaction } from "@/lib/transaction";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" };
}

function hashDeviceKey(deviceKey: string): string {
  return crypto.createHash("sha256").update(deviceKey.trim(), "utf8").digest("hex");
}

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ success: false, error: message, code }, { status, headers: noStoreHeaders() });
}

async function parseBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) return request.json().catch(() => null);
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }
  return null;
}

function resultResponse(result: {
  user: { id: string; name: string; email: string; role: string; restaurantId: string };
  subscription: { id: string; plan: string; status: string; startsAt: Date; expiresAt: Date; maxDevices: number };
  device: { id: string; name: string | null; status: string; activatedAt: Date | null };
}) {
  const loggedInAt = new Date();
  const offlineLease = createOfflineLease(loggedInAt);
  const authUser: AuthUser = result.user as AuthUser;
  const token = generateToken(authUser, offlineLease);

  const response = NextResponse.json({
    success: true,
    user: result.user,
    subscription: {
      id: result.subscription.id,
      plan: result.subscription.plan,
      status: result.subscription.status,
      startsAt: result.subscription.startsAt.toISOString(),
      expiresAt: result.subscription.expiresAt.toISOString(),
      maxDevices: result.subscription.maxDevices,
    },
    device: {
      id: result.device.id,
      name: result.device.name,
      status: result.device.status,
      activatedAt: result.device.activatedAt?.toISOString() ?? null,
    },
    offlineLease,
  }, { status: 200, headers: noStoreHeaders() });
  response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
  return response;
}

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipLimit = rateLimit(`login-ip:${ip}`, 12, 15 * 60_000);
  if (!ipLimit.allowed) return errorResponse("Too many login attempts. Try again later.", 429, "RATE_LIMITED");

  try {
    const validation = loginSchema.safeParse(await parseBody(request));
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid login information.", 400, "VALIDATION_ERROR");
    }

    const { name, restaurantName, email, password, activationCode, deviceKey } = validation.data;
    const accountLimit = rateLimit(`login-account:${email}`, 10, 15 * 60_000);
    if (!accountLimit.allowed) return errorResponse("Too many login attempts for this account. Try again later.", 429, "RATE_LIMITED");
    const normalizedCode = activationCode?.trim().toUpperCase() || "";
    const deviceKeyHash = hashDeviceKey(deviceKey);

    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true, name: true, email: true, password: true, role: true, isActive: true, restaurantId: true,
        restaurant: { select: { isActive: true } },
      },
    });

    // First install: a fresh activation code can create the tenant + owner + subscription + device atomically.
    if (!user) {
      if (!normalizedCode) return errorResponse("Account not found. Enter the activation code supplied by Kitchen Diaries.", 401, "ACCOUNT_NOT_FOUND");

      const activated = await createCustomerFromActivation({
        code: normalizedCode,
        name,
        email,
        password,
        restaurantName,
        deviceKey,
        deviceName: `${name?.trim() || restaurantName?.trim() || "Kitchen Diaries"}'s POS`,
      });
      user = { ...activated.user, password: "", isActive: true, restaurant: { isActive: true } };
      return resultResponse({ user: activated.user, subscription: activated.subscription, device: activated.device });
    }

    if (!user.isActive || !user.restaurant.isActive) return errorResponse("This account is inactive.", 403, "ACCOUNT_INACTIVE");
    if (!(await comparePassword(password, user.password))) return errorResponse("Invalid email or password.", 401, "INVALID_CREDENTIALS");

    const now = new Date();
    const subscription = await prisma.subscription.findFirst({
      where: { restaurantId: user.restaurantId, status: "ACTIVE", expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
      select: { id: true, plan: true, status: true, startsAt: true, expiresAt: true, maxDevices: true },
    });

    if (!subscription && normalizedCode) {
      const activated = await activateExistingCustomer({
        code: normalizedCode,
        restaurantId: user.restaurantId,
        userId: user.id,
        deviceKey,
        deviceName: `${user.name}'s POS`,
      });
      user = { ...user, password: "" };
      return resultResponse({ user, subscription: activated.subscription, device: activated.device });
    }

    if (!subscription) {
      await prisma.subscription.updateMany({
        where: { restaurantId: user.restaurantId, status: "ACTIVE", expiresAt: { lte: now } },
        data: { status: "EXPIRED" },
      });
      return errorResponse("Your subscription is inactive or expired. Enter a valid new activation code.", 403, "SUBSCRIPTION_REQUIRED");
    }

    let device = await prisma.device.findUnique({
      where: { deviceKeyHash },
      select: { id: true, name: true, status: true, activatedAt: true, restaurantId: true },
    });

    if (device && device.restaurantId !== user.restaurantId) return errorResponse("This device is already bound to another restaurant.", 403, "DEVICE_BOUND_ELSEWHERE");
    if (device && device.status !== "ACTIVE") return errorResponse("This device is revoked or blocked. Contact Kitchen Diaries support.", 403, "DEVICE_NOT_ACTIVE");

    if (!device) {
      try {
        device = await withSerializableTransaction(async (transaction) => {
          const lockedSubscription = await transaction.subscription.findFirst({
            where: {
              restaurantId: user!.restaurantId,
              status: "ACTIVE",
              expiresAt: { gt: now },
            },
            orderBy: { expiresAt: "desc" },
            select: { maxDevices: true },
          });

          if (!lockedSubscription) {
            throw new Error("SUBSCRIPTION_REQUIRED");
          }

          const activeCount = await transaction.device.count({
            where: {
              restaurantId: user!.restaurantId,
              status: "ACTIVE",
            },
          });

          if (activeCount >= Math.max(1, lockedSubscription.maxDevices)) {
            throw new Error(`Device limit reached (${lockedSubscription.maxDevices}).`);
          }

          return transaction.device.create({
            data: {
              deviceKeyHash,
              name: `${user!.name}'s POS`,
              status: "ACTIVE",
              activatedAt: now,
              lastSeenAt: now,
              restaurantId: user!.restaurantId,
              activatedById: user!.id,
            },
            select: {
              id: true,
              name: true,
              status: true,
              activatedAt: true,
              restaurantId: true,
            },
          });
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.startsWith("Device limit reached")) {
          return errorResponse(message, 409, "DEVICE_LIMIT_REACHED");
        }
        if (message === "SUBSCRIPTION_REQUIRED") {
          return errorResponse("Your subscription is inactive or expired. Enter a valid new activation code.", 403, "SUBSCRIPTION_REQUIRED");
        }
        throw error;
      }
    }

    await withSerializableTransaction(async (transaction) => {
      await transaction.user.update({ where: { id: user!.id }, data: { lastLoginAt: now } });
      await transaction.device.update({ where: { id: device!.id }, data: { lastSeenAt: now } });
      await writeAuditLog(transaction, {
        restaurantId: user!.restaurantId,
        userId: user!.id,
        module: "AUTH",
        action: "LOGIN",
        entityType: "User",
        entityId: user!.id,
        newData: { email: user!.email, role: user!.role, loggedInAt: now.toISOString() },
      });
    });

    return resultResponse({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, restaurantId: user.restaurantId },
      subscription,
      device,
    });
  } catch (error) {
    console.error("LOGIN_ROUTE_ERROR", error);
    const message = error instanceof Error ? error.message : "Login could not be completed.";
    return errorResponse(message, 400, "LOGIN_FAILED");
  }
}
