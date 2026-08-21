import Link from "next/link";
import {
  ArrowLeft,
} from "lucide-react";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  AuditJsonPanel,
} from "@/features/audit-logs/components/audit-json-panel";
import {
  getAuditLogDetail,
} from "@/features/audit-logs/queries/audit-log-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface AuditLogDetailPageProps {
  params: Promise<{
    auditLogId: string;
  }>;
}

function formatLabel(
  value: string,
): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function formatDateTime(
  value: string,
): string {
  return new Date(
    value,
  ).toLocaleString(
    "en-IN",
    {
      timeZone:
        "Asia/Kolkata",

      dateStyle:
        "full",

      timeStyle:
        "long",
    },
  );
}

export default async function AuditLogDetailPage({
  params,
}: AuditLogDetailPageProps) {
  const { auditLogId } =
    await params;

  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.AUDIT_LOG_READ,
    )
  ) {
    redirect("/unauthorized");
  }

  if (!user.restaurantId) {
    redirect("/unauthorized");
  }

  const auditLog =
    await getAuditLogDetail(
      user.restaurantId,
      auditLogId,
    );

  if (!auditLog) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <Link
            href="/audit-logs"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Audit Logs
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {formatLabel(
                auditLog.action,
              )}
            </h1>

            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              {formatLabel(
                auditLog.module,
              )}
            </span>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            {formatDateTime(
              auditLog.createdAt,
            )}
          </p>
        </header>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">
                User
              </p>

              <p className="mt-1 font-semibold">
                {auditLog.userName ??
                  "System"}
              </p>

              {auditLog.userEmail && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {auditLog.userEmail}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Role
              </p>

              <p className="mt-1 font-semibold">
                {auditLog.userRole
                  ? formatLabel(
                      auditLog.userRole,
                    )
                  : "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Entity Type
              </p>

              <p className="mt-1 font-semibold">
                {auditLog.entityType ??
                  "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Entity ID
              </p>

              <p className="mt-1 break-all font-mono text-xs font-semibold">
                {auditLog.entityId ??
                  "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Request ID
              </p>

              <p className="mt-1 break-all font-mono text-xs font-semibold">
                {auditLog.requestId ??
                  "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                IP Address
              </p>

              <p className="mt-1 font-semibold">
                {auditLog.ipAddress ??
                  "—"}
              </p>
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">
                User Agent
              </p>

              <p className="mt-1 break-words text-sm">
                {auditLog.userAgent ??
                  "—"}
              </p>
            </div>
          </div>

          {auditLog.reason && (
            <div className="mt-5 border-t pt-5">
              <p className="text-xs text-muted-foreground">
                Reason
              </p>

              <p className="mt-1 whitespace-pre-wrap text-sm">
                {auditLog.reason}
              </p>
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <AuditJsonPanel
            title="Previous Data"
            value={
              auditLog.oldData
            }
            emptyMessage="No previous data was recorded for this event."
          />

          <AuditJsonPanel
            title="New Data"
            value={
              auditLog.newData
            }
            emptyMessage="No new data was recorded for this event."
          />
        </div>
      </div>
    </main>
  );
}