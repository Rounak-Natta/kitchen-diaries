"use client";

import { memo, useState } from "react";

import DashboardNavbar from "./dashboard-navbar";

import DashboardSidebar from "./dashboard-sidebar";

function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] =
    useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* SIDEBAR */}
      <DashboardSidebar
        collapsed={collapsed}
      />

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardNavbar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto">
          <div className="page-container py-5 lg:py-6">
            <div className="section-gap">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default memo(
  DashboardShell
);