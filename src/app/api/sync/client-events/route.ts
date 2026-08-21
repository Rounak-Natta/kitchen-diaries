import crypto from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { recordUserBug } from "@/lib/system-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clientBugSchema = z.object({
  source: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(2_000),
  stack: z.string().max(12_000).optional(),
  path: z.string().max(500).optional(),
  deviceId: z.string().max(100).optional(),
  occurredAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const limit = rateLimit(`client-bugs:${user.id}`, 60, 5 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many error reports." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid bug report." },
      { status: 400 },
    );
  }

  const parsed = clientBugSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid bug report." },
      { status: 400 },
    );
  }

  let verifiedDeviceId: string | null = null;
  if (parsed.data.deviceId) {
    const device = await prisma.device.findFirst({
      where: {
        id: parsed.data.deviceId,
        restaurantId: user.restaurantId,
      },
      select: { id: true },
    });
    verifiedDeviceId = device?.id ?? null;
  }

  const requestId =
    request.headers.get("x-request-id")?.slice(0, 160) || crypto.randomUUID();

  await recordUserBug({
    severity: "ERROR",
    source: parsed.data.source,
    message: parsed.data.message,
    restaurantId: user.restaurantId,
    deviceId: verifiedDeviceId,
    requestId,
    metadata: {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      path: parsed.data.path,
      stack: parsed.data.stack,
      occurredAt: parsed.data.occurredAt ?? new Date().toISOString(),
      userAgent: request.headers.get("user-agent"),
      ...parsed.data.metadata,
    },
  });

  return NextResponse.json(
    { success: true, requestId },
    { status: 202 },
  );
}
