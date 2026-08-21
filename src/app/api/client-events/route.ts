import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { recordUserBug } from "@/lib/system-event";

export const dynamic = "force-dynamic";

interface ClientEventBody {
  source?: unknown;
  message?: unknown;
  stack?: unknown;
  path?: unknown;
  occurredAt?: unknown;
  deviceId?: unknown;
  metadata?: unknown;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const reportWindows = new Map<string, { count: number; resetAt: number }>();

function limitedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function metadataRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function allowReport(userId: string): boolean {
  const now = Date.now();
  const current = reportWindows.get(userId);

  if (!current || current.resetAt <= now) {
    reportWindows.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request): Promise<Response> {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!allowReport(user.id)) {
    return NextResponse.json(
      { success: false, error: "Too many client event reports." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: ClientEventBody;

  try {
    body = (await request.json()) as ClientEventBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid client event payload." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const source = limitedString(body.source, 80) ?? "CLIENT_RUNTIME";
  const message = limitedString(body.message, 2_000);

  if (!message) {
    return NextResponse.json(
      { success: false, error: "Client event message is required." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const suppliedDeviceId = limitedString(body.deviceId, 191);
  let deviceId: string | null = null;

  if (suppliedDeviceId) {
    const ownedDevice = await prisma.device.findFirst({
      where: {
        id: suppliedDeviceId,
        restaurantId: user.restaurantId,
      },
      select: { id: true },
    });

    deviceId = ownedDevice?.id ?? null;
  }

  const requestId =
    limitedString(request.headers.get("x-request-id"), 160) ?? crypto.randomUUID();
  const path = limitedString(body.path, 500);
  const stack = limitedString(body.stack, 12_000);
  const occurredAt = limitedString(body.occurredAt, 80);

  await recordUserBug({
    source,
    message,
    severity: "ERROR",
    restaurantId: user.restaurantId,
    deviceId,
    requestId,
    metadata: {
      ...(metadataRecord(body.metadata) ?? {}),
      userId: user.id,
      userRole: user.role,
      path: path ?? null,
      stack: stack ?? null,
      occurredAt: occurredAt ?? new Date().toISOString(),
      userAgent: limitedString(request.headers.get("user-agent"), 500) ?? null,
    },
  });

  return NextResponse.json(
    { success: true, data: { requestId } },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
