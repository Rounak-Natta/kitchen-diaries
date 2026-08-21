import {
  redirect,
} from "next/navigation";

import {
  AuditLogFilters,
} from "@/features/audit-logs/components/audit-log-filters";
import {
  AuditLogTable,
} from "@/features/audit-logs/components/audit-log-table";
import {
  getAuditLogList,
} from "@/features/audit-logs/queries/audit-log-queries";
import type {
  AuditLogFiltersInput,
} from "@/features/audit-logs/types";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface AuditLogsPageProps {
  searchParams: Promise<{
    from?:
      | string
      | string[];

    to?:
      | string
      | string[];

    module?:
      | string
      | string[];

    action?:
      | string
      | string[];

    userId?:
      | string
      | string[];

    q?:
      | string
      | string[];

    page?:
      | string
      | string[];
  }>;
}

function firstValue(
  value:
    | string
    | string[]
    | undefined,
): string | undefined {
  if (
    Array.isArray(value)
  ) {
    return value[0];
  }

  return value;
}

function parsePage(
  value:
    | string
    | undefined,
): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed =
    Number.parseInt(
      value,
      10,
    );

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    return undefined;
  }

  return parsed;
}

export default async function AuditLogsPage({
  searchParams,
}: AuditLogsPageProps) {
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

  const search =
    await searchParams;

  const filters:
    AuditLogFiltersInput = {};

  const from =
    firstValue(
      search.from,
    );

  const to =
    firstValue(
      search.to,
    );

  const moduleFilter =
    firstValue(
      search.module,
    );

  const action =
    firstValue(
      search.action,
    );

  const userId =
    firstValue(
      search.userId,
    );

  const query =
    firstValue(
      search.q,
    );

  const page =
    parsePage(
      firstValue(
        search.page,
      ),
    );

  if (from) {
    filters.from = from;
  }

  if (to) {
    filters.to = to;
  }

  if (moduleFilter) {
    filters.module =
      moduleFilter;
  }

  if (action) {
    filters.action =
      action;
  }

  if (userId) {
    filters.userId =
      userId;
  }

  if (query) {
    filters.query =
      query;
  }

  if (page) {
    filters.page =
      page;
  }

  const data =
    await getAuditLogList(
      user.restaurantId,
      filters,
    );

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">
            Audit Logs
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Review important system
            changes, users, entities,
            and request metadata.
          </p>
        </header>

        <AuditLogFilters
          data={data}
        />

        <AuditLogTable
          data={data}
        />
      </div>
    </main>
  );
}