// features/addons/components/addon-skeleton.tsx
"use client";

import { memo } from "react";

export const AddonSkeleton = memo(() => (
  <div className="grid min-w-[800px] grid-cols-[2fr_140px_120px] items-center px-6 py-3">
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
    </div>
    <div className="h-5 w-16 animate-pulse rounded bg-muted" />
    <div className="flex justify-end gap-2">
      <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
      <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
    </div>
  </div>
));