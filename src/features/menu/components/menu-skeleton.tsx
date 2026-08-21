// features/menu/components/menu-skeleton.tsx
"use client";
import { memo } from "react";

export const MenuSkeleton = memo(() => (
  <div className="grid min-w-[1150px] grid-cols-[2fr_120px_120px_120px_100px_130px] items-center px-6 py-4">
    <div className="flex items-center gap-3">
      <div className="h-11 w-11 animate-pulse rounded-2xl bg-muted" />
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
    </div>
    <div className="h-5 w-16 animate-pulse rounded bg-muted" />
    <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
    <div className="flex items-center gap-1"><div className="h-4 w-4 animate-pulse rounded bg-muted" /><div className="h-4 w-12 animate-pulse rounded bg-muted" /></div>
    <div className="flex items-center gap-1"><div className="h-4 w-4 animate-pulse rounded bg-muted" /><div className="h-4 w-12 animate-pulse rounded bg-muted" /></div>
    <div className="flex gap-2"><div className="h-10 w-10 animate-pulse rounded-2xl bg-muted" /><div className="h-10 w-10 animate-pulse rounded-2xl bg-muted" /></div>
  </div>
));