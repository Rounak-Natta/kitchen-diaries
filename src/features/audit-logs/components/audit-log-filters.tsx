import Link from "next/link";

import type {
  AuditLogListResultDto,
} from "../types";

interface AuditLogFiltersProps {
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

export function AuditLogFilters({
  data,
}: AuditLogFiltersProps) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <form
        method="get"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"
      >
        <div>
          <label
            htmlFor="audit-from"
            className="text-sm font-medium"
          >
            From
          </label>

          <input
            id="audit-from"
            name="from"
            type="date"
            defaultValue={
              data.range.from
            }
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label
            htmlFor="audit-to"
            className="text-sm font-medium"
          >
            To
          </label>

          <input
            id="audit-to"
            name="to"
            type="date"
            defaultValue={
              data.range.to
            }
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label
            htmlFor="audit-module"
            className="text-sm font-medium"
          >
            Module
          </label>

          <select
            id="audit-module"
            name="module"
            defaultValue={
              data.filters.module
            }
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">
              All modules
            </option>

            {data.options.modules.map(
              (module) => (
                <option
                  key={module}
                  value={module}
                >
                  {formatLabel(
                    module,
                  )}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor="audit-action"
            className="text-sm font-medium"
          >
            Action
          </label>

          <select
            id="audit-action"
            name="action"
            defaultValue={
              data.filters.action
            }
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">
              All actions
            </option>

            {data.options.actions.map(
              (action) => (
                <option
                  key={action}
                  value={action}
                >
                  {formatLabel(
                    action,
                  )}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor="audit-user"
            className="text-sm font-medium"
          >
            User
          </label>

          <select
            id="audit-user"
            name="userId"
            defaultValue={
              data.filters.userId
            }
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">
              All users
            </option>

            {data.options.users.map(
              (user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.name} —{" "}
                  {formatLabel(
                    user.role,
                  )}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor="audit-query"
            className="text-sm font-medium"
          >
            Search
          </label>

          <input
            id="audit-query"
            name="q"
            type="search"
            defaultValue={
              data.filters.query
            }
            placeholder="Entity, reason, request…"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-2 md:col-span-2 xl:col-span-6">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Apply Filters
          </button>

          <Link
            href="/audit-logs"
            className="inline-flex h-10 items-center justify-center rounded-md border px-5 text-sm font-medium transition hover:bg-muted"
          >
            Reset
          </Link>
        </div>
      </form>

      <p className="mt-4 text-xs text-muted-foreground">
        Showing audit events for{" "}
        {data.range.dayCount}{" "}
        business day
        {data.range.dayCount === 1
          ? ""
          : "s"}
        , from {data.range.from} to{" "}
        {data.range.to}.
      </p>

      {data.range.warning && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {data.range.warning}
        </p>
      )}
    </section>
  );
}