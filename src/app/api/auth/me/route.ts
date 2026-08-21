import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const [device, subscription] = await Promise.all([
    prisma.device.findFirst({
      where: { restaurantId: user.restaurantId, status: "ACTIVE" },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, name: true, status: true, lastSeenAt: true },
    }),
    prisma.subscription.findFirst({
      where: { restaurantId: user.restaurantId },
      orderBy: { expiresAt: "desc" },
      select: { plan: true, status: true, startsAt: true, expiresAt: true, maxDevices: true },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: { user, device, subscription },
  }, { headers: { "Cache-Control": "no-store" } });
}
