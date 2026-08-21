import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

function hashDeviceKey(deviceKey: string): string {
  return crypto.createHash("sha256").update(deviceKey.trim(), "utf8").digest("hex");
}

export async function GET(request: Request): Promise<Response> {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  const deviceKey = request.headers.get("x-device-key")?.trim();
  if (!deviceKey) {
    return NextResponse.json({ success: false, error: "Device key is required." }, { status: 400 });
  }

  const deviceKeyHash = hashDeviceKey(deviceKey);

  const [device, subscription] = await Promise.all([
    prisma.device.findUnique({
      where: { deviceKeyHash },
      select: {
        id: true,
        name: true,
        status: true,
        activatedAt: true,
        lastSeenAt: true,
        revokedAt: true,
        restaurantId: true,
      },
    }),
    prisma.subscription.findFirst({
      where: { restaurantId: user.restaurantId },
      orderBy: { expiresAt: "desc" },
      select: {
        id: true,
        plan: true,
        status: true,
        startsAt: true,
        expiresAt: true,
        maxDevices: true,
      },
    }),
  ]);

  const ownsDevice = Boolean(device && device.restaurantId === user.restaurantId);

  return NextResponse.json(
    {
      success: true,
      data: {
        device: ownsDevice ? device : null,
        subscription,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
