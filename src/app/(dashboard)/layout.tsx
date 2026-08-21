import {
  connection,
} from "next/server";

import DashboardShell from "@/components/layout/dashboard-shell";
import { OfflineAccessGuard } from "@/components/sync/offline-access-guard";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  /*
   * Everything below this point is rendered only
   * when an incoming request exists.
   */
  await connection();

  return (
    <main className="min-h-screen bg-[#0B0B0F]">
      <OfflineAccessGuard>
        <DashboardShell>
          {children}
        </DashboardShell>
      </OfflineAccessGuard>
    </main>
  );
}