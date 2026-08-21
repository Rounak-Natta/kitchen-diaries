"use client";

import { memo } from "react";

import Image from "next/image";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { dashboardNav } from "@/config/dashboard-nav";

import { cn } from "@/lib/utils";

interface Props {
  collapsed: boolean;
}

function DashboardSidebar({
  collapsed,
}: Props) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        [
          "hidden lg:flex",
          "h-screen flex-col",
          "border-r border-border",
          "bg-card",
          "transition-all duration-300",
        ],

        collapsed
          ? "w-[88px]"
          : "w-[260px]"
      )}
    >
      {/* LOGO */}
      <div className="flex h-[74px] items-center border-b border-border px-4">
        <Link
          href="/dashboard"
          className={cn(
            "flex w-full items-center",

            collapsed
              ? "justify-center"
              : "gap-3"
          )}
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <Image
              src="/assets/logo/logo1.png"
              alt="KD POS"
              width={28}
              height={28}
              className="object-contain"
            />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-semibold tracking-[-0.03em] text-foreground">
                Kitchen Diaries
              </h2>

              <p className="mt-0.5 text-sm text-muted-foreground">
                Restaurant POS
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* NAVIGATION */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        {!collapsed && (
          <p className="mb-4 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Navigation
          </p>
        )}

        <nav className="space-y-1">
          {dashboardNav.map(
            (item) => {
              const active =
                pathname === item.href;

              const Icon =
                item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    [
                      "group flex items-center",
                      "transition-all duration-200",
                      "rounded-2xl",
                    ],

                    collapsed
                      ? "justify-center h-12"
                      : "h-12 gap-3 px-4",

                    active
                        ? [
                            "bg-primary",
                            "text-white",
                            "shadow-sm",
                          ]
                        : [
                            "text-slate-600",
                            "hover:bg-muted",
                            "hover:text-foreground",
                          ] 
                                        )}
                >
                  <Icon
                      size={18}
                      className={cn(
                        active
                          ? "text-white"
                          : "text-slate-500 group-hover:text-foreground"
                      )}
                    />

                  {!collapsed && (
                    <span className="text-sm font-medium">
                      {item.title}
                    </span>
                  )}
                </Link>
              );
            }
          )}
        </nav>
      </div>

     
    </aside>
  );
}

export default memo(
  DashboardSidebar
);