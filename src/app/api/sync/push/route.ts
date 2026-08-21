import {
  NextResponse,
} from "next/server";

import {
  getAuthUser,
} from "@/lib/api-auth";

import {
  pushSyncOperations,
} from "@/features/sync/lib/push-sync-operations";

import {
  syncPushRequestSchema,
} from "@/features/sync/validations/sync";

import { recordUserBug } from "@/lib/system-event";

export const dynamic =
  "force-dynamic";

// ======================================================
// POST /api/sync/push
// ======================================================

export async function POST(
  request: Request,
): Promise<Response> {
  let bugContext: {
    id: string;
    restaurantId: string;
    name: string;
    email: string;
    role: string;
  } | null = null;

  try {
    // --------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------

    const user =
      await getAuthUser(
        request,
      );

    if (!user) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Unauthorized",
        },
        {
          status:
            401,
        },
      );
    }

    bugContext = {
      id: user.id,
      restaurantId: user.restaurantId,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // --------------------------------------------------
    // REQUEST BODY
    // --------------------------------------------------

    let body: unknown;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Invalid sync request.",
        },
        {
          status:
            400,
        },
      );
    }

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    const parsed =
      syncPushRequestSchema.safeParse(
        body,
      );

    if (!parsed.success) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Invalid sync request.",
        },
        {
          status:
            400,
        },
      );
    }

    // --------------------------------------------------
    // PROCESS SYNC
    // --------------------------------------------------

    const results =
      await pushSyncOperations(
        parsed.data.operations,
        {
          userId:
            user.id,

          restaurantId:
            user.restaurantId,

          role:
            user.role,
        },
      );

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    const failedResults =
      results.filter((result) =>
        result.status === "FAILED" ||
        result.status === "CONFLICT",
      );

    const hasOperationFailures =
      failedResults.length > 0;

    if (hasOperationFailures) {
      await Promise.allSettled(
        failedResults.slice(0, 25).map((result) => {
          const operation =
            parsed.data.operations.find(
              (candidate) => candidate.operationId === result.operationId,
            );

          return recordUserBug({
            severity: result.status === "CONFLICT" ? "WARN" : "ERROR",
            source: "SYNC",
            message: result.error || `Sync operation ${result.status.toLowerCase()}.`,
            restaurantId: user.restaurantId,
            deviceId: operation?.deviceId ?? null,
            requestId: request.headers.get("x-request-id"),
            metadata: {
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
              userRole: user.role,
              operationId: result.operationId,
              operationType: operation?.operationType,
              entityType: operation?.entityType,
              entityId: operation?.entityId,
              syncStatus: result.status,
              duplicate: result.duplicate,
              path: "/api/sync/push",
              method: "POST",
            },
          });
        }),
      );
    }

    return NextResponse.json(
      {
        success: true,
        partialFailure: hasOperationFailures,
        data: {
          results,
        },
      },
      {
        // 207 keeps batch semantics (the client still receives every result)
        // while avoiding a misleading 200 when one or more operations failed.
        status: hasOperationFailures ? 207 : 200,
      },
    );
  } catch (
    error: unknown
  ) {
    console.error(
      "POST /api/sync/push error:",
      error,
    );

    await recordUserBug({
      severity: "ERROR",
      source: "SYNC_ROUTE",
      message:
        error instanceof Error
          ? error.message
          : "Unexpected sync route failure.",
      restaurantId: bugContext?.restaurantId ?? null,
      requestId: request.headers.get("x-request-id"),
      metadata: {
        userId: bugContext?.id,
        userName: bugContext?.name,
        userEmail: bugContext?.email,
        userRole: bugContext?.role,
        path: "/api/sync/push",
        method: "POST",
        errorName: error instanceof Error ? error.name : "UnknownError",
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    return NextResponse.json(
      {
        success:
          false,

        error:
          "Failed to process sync request.",
      },
      {
        status:
          500,
      },
    );
  }
}