"use client";
import { memo } from "react";

export const VariationSkeleton = memo(() => (
  <div className="grid min-w-[1100px] grid-cols-[2fr_140px_140px_180px] items-center px-6 py-4">
    <div className="flex items-center gap-3">
      <div className="h-11 w-11 animate-pulse rounded-2xl bg-muted" />
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
      </div>
    </div>
    <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
    <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
    <div className="flex justify-end gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 w-10 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  </div>
));