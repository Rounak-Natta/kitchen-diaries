"use client";

import { memo, useMemo } from "react";

import {
  Menu,
  Search,
} from "lucide-react";

import { usePathname } from "next/navigation";

import { Input } from "@/components/ui/input";
import { SyncStatusIndicator } from "@/components/sync/sync-status-indicator";
import { NotificationCenter } from "@/features/notifications/components/notification-center";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/categories": "Categories",
  "/menu": "Menu",
  "/variations": "Variations",
  "/addons": "Addons",
  "/orders": "Orders",
  "/billing": "Billing",
};

interface Props {
  collapsed: boolean;

  setCollapsed: React.Dispatch<
    React.SetStateAction<boolean>
  >;
}

function DashboardNavbar({
  setCollapsed,
}: Props) {
  const pathname = usePathname();

  const title = useMemo(() => {
    return (
      TITLES[pathname] ||
      "Dashboard"
    );
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-[76px] items-center justify-between px-4 lg:px-6">
        {/* LEFT */}
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              setCollapsed(
                (prev) => !prev
              )
            }
            className="flex size-11 items-center justify-center rounded-2xl border border-border bg-card transition-colors hover:bg-muted"
          >
            <Menu size={18} />
          </button>

          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.04em] text-foreground">
              {title}
            </h1>

            <p className="mt-0.5 text-xs text-muted-foreground">
              Restaurant management
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3">
          {/* SEARCH */}
          <div className="relative hidden lg:block">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <Input
              placeholder="Quick search..."
              className="w-[240px] pl-11"
            />
          </div>

          <SyncStatusIndicator />

          <NotificationCenter />

          {/* USER */}
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-sm">
            KD
          </div>
        </div>
      </div>
    </header>
  );
}

export default memo(
  DashboardNavbar
);