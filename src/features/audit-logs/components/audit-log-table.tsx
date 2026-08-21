import Link from "next/link";

import type {
  AuditLogListResultDto,
} from "../types";

interface AuditLogTableProps {
  data: AuditLogListResultDto;
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
        "medium",

      timeStyle:
        "medium",
    },
  );
}

function buildPageHref(
  data: AuditLogListResultDto,
  page: number,
): string {
  const params =
    new URLSearchParams();

  params.set(
    "from",
    data.range.from,
  );

  params.set(
    "to",
    data.range.to,
  );

  if (data.filters.module) {
    params.set(
      "module",
      data.filters.module,
    );
  }

  if (data.filters.action) {
    params.set(
      "action",
      data.filters.action,
    );
  }

  if (data.filters.userId) {
    params.set(
      "userId",
      data.filters.userId,
    );
  }

  if (data.filters.query) {
    params.set(
      "q",
      data.filters.query,
    );
  }

  if (page > 1) {
    params.set(
      "page",
      String(page),
    );
  }

  return `/audit-logs?${params.toString()}`;
}

export function AuditLogTable({
  data,
}: AuditLogTableProps) {
  if (
    data.rows.length === 0
  ) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        No audit events matched the
        selected filters.
      </div>
    );
  }

  const firstRow =
    (
      data.pagination.page -
      1
    ) *
      data.pagination.pageSize +
    1;

  const lastRow =
    Math.min(
      data.pagination.page *
        data.pagination.pageSize,

      data.pagination.totalRows,
    );

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold">
            Audit Events
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Showing {firstRow}–
            {lastRow} of{" "}
            {
              data.pagination
                .totalRows
            }{" "}
            events.
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Page{" "}
          {
            data.pagination
              .page
          }{" "}
          of{" "}
          {
            data.pagination
              .totalPages
          }
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">
                Date and Time
              </th>

              <th className="px-4 py-3 font-medium">
                Module / Action
              </th>

              <th className="px-4 py-3 font-medium">
                User
              </th>

              <th className="px-4 py-3 font-medium">
                Entity
              </th>

              <th className="px-4 py-3 font-medium">
                Details
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {data.rows.map(
              (log) => (
                <tr
                  key={log.id}
                  className="align-top hover:bg-muted/20"
                >
                  <td className="whitespace-nowrap px-4 py-4">
                    <p className="font-medium">
                      {formatDateTime(
                        log.createdAt,
                      )}
                    </p>

                    {log.requestId && (
                      <p className="mt-1 max-w-48 truncate font-mono text-xs text-muted-foreground">
                        {log.requestId}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {formatLabel(
                        log.module,
                      )}
                    </span>

                    <p className="mt-2 font-medium">
                      {formatLabel(
                        log.action,
                      )}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    <p className="font-medium">
                      {log.userName ??
                        "System"}
                    </p>

                    {log.userEmail && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {log.userEmail}
                      </p>
                    )}

                    {log.userRole && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatLabel(
                          log.userRole,
                        )}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <p className="font-medium">
                      {log.entityType ??
                        "—"}
                    </p>

                    {log.entityId && (
                      <p className="mt-1 max-w-52 break-all font-mono text-xs text-muted-foreground">
                        {log.entityId}
                      </p>
                    )}
                  </td>

                  <td className="max-w-80 px-4 py-4">
                    {log.reason ? (
                      <p className="line-clamp-3 text-muted-foreground">
                        {log.reason}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        No reason recorded.
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {log.hasOldData && (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">
                          Old data
                        </span>
                      )}

                      {log.hasNewData && (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">
                          New data
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/audit-logs/${log.id}`}
                      className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-medium transition hover:bg-muted"
                    >
                      Inspect
                    </Link>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 border-t p-4">
        {data.pagination.page >
        1 ? (
          <Link
            href={buildPageHref(
              data,
              data.pagination
                .page - 1,
            )}
            className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium transition hover:bg-muted"
          >
            Previous
          </Link>
        ) : (
          <span className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm text-muted-foreground opacity-50">
            Previous
          </span>
        )}

        <span className="text-sm text-muted-foreground">
          {
            data.pagination
              .totalRows
          }{" "}
          total events
        </span>

        {data.pagination.page <
        data.pagination
          .totalPages ? (
          <Link
            href={buildPageHref(
              data,
              data.pagination
                .page + 1,
            )}
            className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium transition hover:bg-muted"
          >
            Next
          </Link>
        ) : (
          <span className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm text-muted-foreground opacity-50">
            Next
          </span>
        )}
      </div>
    </section>
  );
}