import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30), 1), 50);

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        restaurantId: user.restaurantId,
        userId: user.id,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        entityType: true,
        entityId: true,
        orderId: true,
        orderNumber: true,
        status: true,
        dedupeKey: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: {
        restaurantId: user.restaurantId,
        userId: user.id,
        readAt: null,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: { notifications, unreadCount },
  });
}

export async function PATCH(request: Request) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: unknown; all?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const now = new Date();

  if (body.all === true) {
    await prisma.notification.updateMany({
      where: {
        restaurantId: user.restaurantId,
        userId: user.id,
        readAt: null,
      },
      data: { readAt: now },
    });
  } else if (typeof body.id === "string" && body.id.trim()) {
    await prisma.notification.updateMany({
      where: {
        id: body.id,
        restaurantId: user.restaurantId,
        userId: user.id,
      },
      data: { readAt: now },
    });
  } else {
    return NextResponse.json({ success: false, error: "Notification id is required." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
