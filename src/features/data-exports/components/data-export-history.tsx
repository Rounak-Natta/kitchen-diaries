import type {
  ExportStatus,
} from "@prisma/client";

import type {
  DataExportHistoryItemDto,
} from "../types";

interface DataExportHistoryProps {
  exports:
    DataExportHistoryItemDto[];
}

function formatLabel(
  value: string,
): string {
  return value
    .toLowerCase()
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function formatDateTime(
  value:
    | string
    | null,
): string {
  if (!value) {
    return "—";
  }

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

function getStatusClass(
  status: ExportStatus,
): string {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700";

    case "FAILED":
      return "bg-red-50 text-red-700";

    case "PROCESSING":
      return "bg-blue-50 text-blue-700";

    case "EXPIRED":
      return "bg-slate-100 text-slate-700";

    default:
      return "bg-amber-50 text-amber-700";
  }
}

export function DataExportHistory({
  exports,
}: DataExportHistoryProps) {
  if (
    exports.length === 0
  ) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-10 text-center">
        <p className="font-medium">
          No exports have been
          generated.
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          Completed and failed
          backup requests will appear
          here.
        </p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b p-5">
        <h2 className="font-semibold">
          Export History
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          The latest 100 data
          export requests.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">
                Export
              </th>

              <th className="px-4 py-3 font-medium">
                Status
              </th>

              <th className="px-4 py-3 font-medium">
                Requested By
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Records
              </th>

              <th className="px-4 py-3 font-medium">
                Checksum
              </th>

              <th className="px-4 py-3 font-medium">
                Requested
              </th>

              <th className="px-4 py-3 font-medium">
                Completed
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {exports.map(
              (item) => (
                <tr
                  key={item.id}
                  className="align-top hover:bg-muted/20"
                >
                  <td className="px-4 py-4">
                    <p className="font-mono text-xs font-semibold">
                      {
                        item.exportNumber
                      }
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatLabel(
                        item.type,
                      )}
                      {" · "}
                      {formatLabel(
                        item.format,
                      )}
                    </p>

                    {item.fileName && (
                      <p className="mt-1 max-w-64 truncate text-xs text-muted-foreground">
                        {
                          item.fileName
                        }
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                        item.status,
                      )}`}
                    >
                      {formatLabel(
                        item.status,
                      )}
                    </span>

                    {item.errorMessage && (
                      <p className="mt-2 max-w-72 text-xs text-red-700">
                        {
                          item.errorMessage
                        }
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <p className="font-medium">
                      {item.requestedByName ??
                        "System"}
                    </p>

                    {item.requestedByEmail && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {
                          item.requestedByEmail
                        }
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-4 text-right">
                    {item.totalRows ??
                      "—"}
                  </td>

                  <td className="px-4 py-4">
                    {item.sha256 ? (
                      <code
                        title={
                          item.sha256
                        }
                        className="block max-w-48 truncate rounded bg-muted px-2 py-1 text-xs"
                      >
                        {
                          item.sha256
                        }
                      </code>
                    ) : (
                      <span className="text-muted-foreground">
                        —
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                    {formatDateTime(
                      item.createdAt,
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                    {formatDateTime(
                      item.completedAt,
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}