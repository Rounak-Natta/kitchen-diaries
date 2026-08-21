import {
  Database,
  FileJson,
  ShieldCheck,
} from "lucide-react";
import {
  redirect,
} from "next/navigation";

import {
  DataExportHistory,
} from "@/features/data-exports/components/data-export-history";
import {
  FullDataExportButton,
} from "@/features/data-exports/components/full-data-export-button";
import {
  getDataExportHistory,
} from "@/features/data-exports/queries/data-export-queries";
import {
  getAuthUser,
} from "@/lib/api-auth";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

export default async function DataExportsPage() {
  const user =
    await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      PERMISSIONS.DATA_EXPORT,
    )
  ) {
    redirect(
      "/unauthorized",
    );
  }

  if (!user.restaurantId) {
    redirect(
      "/unauthorized",
    );
  }

  const exports =
    await getDataExportHistory(
      user.restaurantId,
    );

  const completedCount =
    exports.filter(
      (item) =>
        item.status ===
        "COMPLETED",
    ).length;

  const failedCount =
    exports.filter(
      (item) =>
        item.status ===
        "FAILED",
    ).length;

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Data Export and
              Backup
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Download a complete
              restaurant data
              snapshot for secure
              offline storage.
            </p>
          </div>

          <FullDataExportButton />
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Database className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Export Requests
                </p>

                <p className="text-2xl font-bold">
                  {
                    exports.length
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Completed
                </p>

                <p className="text-2xl font-bold text-emerald-700">
                  {
                    completedCount
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-50 text-red-700">
                <FileJson className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Failed
                </p>

                <p className="text-2xl font-bold text-red-700">
                  {
                    failedCount
                  }
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">
            Backup security
          </h2>

          <div className="mt-2 space-y-1 text-sm text-amber-800">
            <p>
              The backup contains
              restaurant, customer,
              billing, payment,
              inventory, recipe,
              wastage and audit-log
              information.
            </p>

            <p>
              User password hashes
              are never included.
            </p>

            <p>
              Store the downloaded
              file in an encrypted,
              access-controlled
              location.
            </p>
          </div>
        </section>

        <DataExportHistory
          exports={exports}
        />
      </div>
    </main>
  );
}